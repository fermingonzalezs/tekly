import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { resolveProveedorId } from "@/lib/db/inventario";
import type { Checklist, Compra, CompraEstado, CompraItem, MedioPago } from "@/lib/types";

type CompraRow = {
  id: string;
  numero: number;
  fecha: string;
  origen: "proveedor" | "canje";
  proveedor_nombre: string | null;
  cliente_id: string | null;
  cliente_nombre: string | null;
  venta: { numero: number } | { numero: number }[] | null;
  items: CompraItem[];
  total_usd: number;
  medio_pago: MedioPago;
  caja_id: string | null;
  estado: CompraEstado;
  monto_ars: number | null;
  cotizacion: number | null;
  marca: string | null;
  imei: string | null;
  checklist: Checklist | null;
  aclaraciones: string | null;
};

const COMPRA_COLS =
  "id, numero, fecha, origen, proveedor_nombre, cliente_id, cliente_nombre, venta:ventas(numero), items, total_usd, medio_pago, caja_id, estado, monto_ars, cotizacion, marca, imei, checklist, aclaraciones";

function toCompra(row: CompraRow): Compra {
  const venta = Array.isArray(row.venta) ? row.venta[0] : row.venta;
  return {
    id: `C-${row.numero}`,
    fecha: new Date(row.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }),
    fechaISO: row.fecha.slice(0, 10),
    origen: row.origen,
    proveedor: row.proveedor_nombre ?? undefined,
    clienteId: row.cliente_id ?? undefined,
    cliente: row.cliente_nombre ?? undefined,
    ventaId: venta ? `V-${venta.numero}` : undefined,
    items: row.items ?? [],
    totalUsd: row.total_usd,
    medioPago: row.medio_pago,
    cajaId: row.caja_id ?? undefined,
    estado: row.estado,
    montoArs: row.monto_ars ?? undefined,
    cotizacion: row.cotizacion ?? undefined,
    marca: row.marca ?? undefined,
    imei: row.imei ?? undefined,
    checklist: row.checklist ?? undefined,
    aclaraciones: row.aclaraciones ?? undefined,
  };
}

export async function listCompras(): Promise<Compra[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("compras")
    .select(COMPRA_COLS)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return (data as unknown as CompraRow[]).map(toCompra);
}

/** `proveedor` -- compra a proveedor de siempre (default). Un canje
 * generado desde "Nueva venta" (`lib/db/ventas.ts` → `createVenta`) pasa
 * `origen: "canje"` + `clienteId`/`clienteNombre`/`ventaId` en vez de
 * `proveedor`, y no pasa por `resolveProveedorId` -- el cliente no es un
 * proveedor de repuestos, no tiene sentido sumarlo a esa tabla. */
export async function createCompra(data: {
  origen?: "proveedor" | "canje";
  proveedor?: string;
  clienteId?: string;
  clienteNombre?: string;
  ventaId?: string;
  items: CompraItem[];
  totalUsd: number;
  medioPago: MedioPago;
  /** Solo `origen === "proveedor"`: caja de la que salió el pago -- al
   * confirmar genera el egreso correspondiente en `movimientos_caja`
   * (mismo criterio que `createVenta` con los pagos). */
  cajaId?: string;
  estado?: CompraEstado;
  montoArs?: number;
  cotizacion?: number;
  marca?: string;
  imei?: string;
  checklist?: Checklist;
  aclaraciones?: string;
  /** Nombre del usuario logueado -- lo resuelve `createCompraAction` con
   * `requireUser()`; la puerta de auth vive en `actions.ts`, no acá. */
  usuarioNombre: string;
}): Promise<Compra> {
  const origen = data.origen ?? "proveedor";
  const proveedorId =
    origen === "proveedor" && data.proveedor ? await resolveProveedorId(data.proveedor) : null;
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("compras")
    .insert({
      origen,
      proveedor_id: proveedorId,
      proveedor_nombre: origen === "proveedor" ? data.proveedor : null,
      cliente_id: origen === "canje" ? data.clienteId ?? null : null,
      cliente_nombre: origen === "canje" ? data.clienteNombre ?? null : null,
      venta_id: data.ventaId ?? null,
      items: data.items,
      total_usd: data.totalUsd,
      medio_pago: data.medioPago,
      caja_id: origen === "proveedor" ? data.cajaId ?? null : null,
      estado: data.estado ?? ("pendiente" satisfies CompraEstado),
      monto_ars: data.montoArs ?? null,
      cotizacion: data.cotizacion ?? null,
      marca: data.marca ?? null,
      imei: data.imei ?? null,
      checklist: data.checklist ?? null,
      aclaraciones: data.aclaraciones ?? null,
    })
    .select(COMPRA_COLS)
    .single();
  if (error) throw error;

  // Egreso en la caja elegida, después de la fila de `compras` para poder
  // armar el concepto con su número (mismo criterio que `createVenta` con
  // los pagos): el movimiento va en la moneda de la caja -- una caja ARS
  // pide el monto en pesos (`montoArs`, ya calculado con la cotización del
  // momento), una caja USD el total en dólares.
  if (origen === "proveedor" && data.cajaId) {
    const { data: caja, error: cajaError } = await supabase
      .from("cajas")
      .select("moneda")
      .eq("id", data.cajaId)
      .single();
    if (cajaError) throw cajaError;

    let monto: number;
    // Dólar del momento, para el snapshot del movimiento. Si solo vino el
    // monto en pesos, se deriva (monto / total USD) -- mismo valor que usó
    // la compra al calcularlo.
    let cotizacion: number | null = data.cotizacion ?? null;
    if (caja.moneda !== "ars") {
      monto = data.totalUsd;
    } else if (data.montoArs != null) {
      monto = data.montoArs;
      if (cotizacion == null && data.totalUsd > 0) cotizacion = data.montoArs / data.totalUsd;
    } else if (data.cotizacion != null) {
      monto = Math.round(data.totalUsd * data.cotizacion);
    } else {
      throw new Error(
        "Falta la cotización del dólar para registrar el egreso en una caja en pesos.",
      );
    }

    const { error: movError } = await supabase.from("movimientos_caja").insert({
      caja_id: data.cajaId,
      concepto: `Compra C-${row.numero} · ${data.proveedor}`,
      medio_pago: data.medioPago,
      tipo: "egreso",
      monto,
      cotizacion,
      usuario_nombre: data.usuarioNombre,
      compra_id: row.id,
    });
    if (movError) throw movError;
  }

  return toCompra(row as unknown as CompraRow);
}

/** `eliminarMovimientoCaja`: borra también el egreso que generó la compra en
 * `movimientos_caja` -- si se deja en `false`, el movimiento sobrevive
 * huérfano (`compra_id` vuelve a `null` solo por el `on delete set null` de
 * la FK), como si fuera manual (mismo criterio que `deleteVenta` documenta
 * para `venta_id`). */
export async function deleteCompra(id: string, eliminarMovimientoCaja = false): Promise<void> {
  const supabase = createServerClient();
  const numero = Number(id.replace(/^C-/, ""));

  const { data: compraRow, error: compraError } = await supabase
    .from("compras")
    .select("id")
    .eq("numero", numero)
    .single();
  if (compraError) throw compraError;

  if (eliminarMovimientoCaja) {
    const { error: movError } = await supabase
      .from("movimientos_caja")
      .delete()
      .eq("compra_id", compraRow.id);
    if (movError) throw movError;
  }

  const { error } = await supabase.from("compras").delete().eq("id", compraRow.id);
  if (error) throw error;
}

export async function marcarRecibida(id: string): Promise<Compra> {
  const supabase = createServerClient();
  const numero = Number(id.replace(/^C-/, ""));
  const { data: row, error } = await supabase
    .from("compras")
    .update({ estado: "recibida" satisfies CompraEstado })
    .eq("numero", numero)
    .select(COMPRA_COLS)
    .single();
  if (error) throw error;
  return toCompra(row as unknown as CompraRow);
}
