import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { fmtDayMonth } from "@/lib/format";
import { addMovimiento } from "@/lib/db/inventario";
import { createMovimientoCC } from "@/lib/db/cuentas-corrientes";
import { montoConRecargo } from "@/lib/ventas";
import type { Pago, Venta, VentaItem } from "@/lib/types";

/** Cantidad de ventas por procedencia (canal) -- usado por
 * `FuenteClientes` en Clientes. */
export async function procedenciaCounts(): Promise<{ label: string; value: number }[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("ventas").select("procedencia");
  if (error) throw error;

  const conteo = new Map<string, number>();
  for (const v of data) {
    const c = v.procedencia ?? "Sin dato";
    conteo.set(c, (conteo.get(c) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

// ─────────────────────────── Ventas ───────────────────────────

type VentaItemRepuestoRow = {
  repuesto_id: string;
  cantidad: number;
  repuestos: { nombre: string } | null;
};

type VentaItemRow = {
  detalle: string;
  cantidad: number;
  precio_usd: number;
  costo_usd: number | null;
  equipo_id: string | null;
  categoria: VentaItem["categoria"] | null;
  venta_item_repuestos: VentaItemRepuestoRow[] | null;
};

type VentaRow = {
  id: string;
  numero: number;
  fecha: string;
  cliente_id: string | null;
  cliente: string;
  vendedor_id: string | null;
  profiles: { nombre: string } | null;
  procedencia: string | null;
  venta_items: VentaItemRow[];
  total_usd: number;
  pagos: Pago[];
  margen_pct: number | null;
  tipo: "venta" | "reparacion";
};

const VENTA_COLS =
  "id, numero, fecha, cliente_id, cliente, vendedor_id, profiles(nombre), procedencia, venta_items(detalle, cantidad, precio_usd, costo_usd, equipo_id, categoria, venta_item_repuestos(repuesto_id, cantidad, repuestos(nombre))), total_usd, pagos, margen_pct, tipo";

function toVentaItem(row: VentaItemRow): VentaItem {
  return {
    detalle: row.detalle,
    cantidad: row.cantidad,
    precioUsd: row.precio_usd,
    costoUsd: row.costo_usd ?? undefined,
    equipoId: row.equipo_id ?? undefined,
    categoria: row.categoria ?? undefined,
    repuestos: (row.venta_item_repuestos ?? []).map((r) => ({
      repuestoId: r.repuesto_id,
      nombre: r.repuestos?.nombre ?? "—",
      cantidad: r.cantidad,
    })),
  };
}

function toVenta(
  row: VentaRow,
  tieneMovimientoCaja: boolean,
  tieneMovimientoCC: boolean,
): Venta {
  return {
    id: `V-${row.numero}`,
    fecha: fmtDayMonth(row.fecha),
    fechaISO: row.fecha.slice(0, 10),
    clienteId: row.cliente_id ?? "",
    cliente: row.cliente,
    vendedorId: row.vendedor_id ?? "",
    vendedor: row.profiles?.nombre ?? "—",
    procedencia: row.procedencia ?? undefined,
    items: (row.venta_items ?? []).map(toVentaItem),
    totalUsd: row.total_usd,
    pagos: row.pagos ?? [],
    margenPct: row.margen_pct ?? 0,
    tipo: row.tipo,
    tieneMovimientoCaja,
    tieneMovimientoCC,
  };
}

export async function listVentas(): Promise<Venta[]> {
  const supabase = createServerClient();
  const [{ data, error }, { data: movsCaja }, { data: movsCC }] = await Promise.all([
    supabase.from("ventas").select(VENTA_COLS).order("fecha", { ascending: false }),
    supabase.from("movimientos_caja").select("venta_id").not("venta_id", "is", null),
    supabase.from("movimientos_cc").select("venta_id").not("venta_id", "is", null),
  ]);
  if (error) throw error;

  const conMovCaja = new Set((movsCaja ?? []).map((m) => m.venta_id as string));
  const conMovCC = new Set((movsCC ?? []).map((m) => m.venta_id as string));

  return (data as unknown as VentaRow[]).map((row) =>
    toVenta(row, conMovCaja.has(row.id), conMovCC.has(row.id)),
  );
}

export type CreateVentaInput = {
  clienteId: string;
  cliente: string;
  vendedorId: string;
  vendedorNombre: string;
  procedencia?: string;
  items: VentaItem[];
  totalUsd: number;
  pagos: Pago[];
  margenPct: number;
  tipo: "venta" | "reparacion";
  /** Cotización blue vigente al momento de la venta -- para convertir a
   * pesos el monto de los pagos que van a una caja ARS (mismo criterio que
   * `Compra.cotizacion`). */
  dolarVenta: number;
};

/** Crea la venta, sus ítems (tabla propia `venta_items`, ver
 * "Backend y multi-tenancy" en CLAUDE.md) y:
 * - si algún ítem viene del stock de equipos (`equipoId`), marca esos
 *   equipos como vendidos;
 * - si algún ítem consumió repuestos (`VentaItem.repuestos`, solo tiene
 *   sentido en ítems de servicio), descuenta ese stock;
 * - por cada `Pago`, genera el movimiento correspondiente: un cargo en
 *   cuentas corrientes si el medio es "cuenta_corriente", o un movimiento
 *   de caja (usando la `cajaId` elegida en "Nueva venta", ya no hay que
 *   adivinar a qué caja fue la plata) para el resto.
 *
 * No es una transacción real (supabase-js no las soporta desde el
 * cliente) -- si un paso fallara quedaría la venta creada sin alguno de
 * estos efectos; aceptable para esta escala, se podría subir a una
 * función de Postgres más adelante si hace falta atomicidad estricta. */
export async function createVenta(data: CreateVentaInput): Promise<Venta> {
  const supabase = createServerClient();
  const { data: ventaRow, error } = await supabase
    .from("ventas")
    .insert({
      cliente_id: data.clienteId || null,
      cliente: data.cliente,
      vendedor_id: data.vendedorId || null,
      procedencia: data.procedencia ?? null,
      total_usd: data.totalUsd,
      pagos: data.pagos,
      margen_pct: data.margenPct,
      tipo: data.tipo,
    })
    .select("id, numero")
    .single();
  if (error) throw error;

  const { data: itemRows, error: itemsError } = await supabase
    .from("venta_items")
    .insert(
      data.items.map((item) => ({
        venta_id: ventaRow.id,
        detalle: item.detalle,
        cantidad: item.cantidad,
        precio_usd: item.precioUsd,
        costo_usd: item.costoUsd ?? null,
        equipo_id: item.equipoId ?? null,
        categoria: item.categoria ?? null,
      })),
    )
    .select("id");
  if (itemsError) throw itemsError;

  const equipoIds = data.items
    .map((i) => i.equipoId)
    .filter((x): x is string => !!x);
  if (equipoIds.length > 0) {
    const { error: updError } = await supabase
      .from("equipos")
      .update({ estado: "vendido" })
      .in("id", equipoIds);
    if (updError) throw updError;
  }

  // Repuestos usados por ítem (solo servicio) -- vincular + descontar
  // stock, mismo patrón leer-y-escribir que `ingresoRepuesto`
  // (lib/db/inventario.ts), restando en vez de sumar.
  for (let i = 0; i < data.items.length; i++) {
    const repuestosUsados = data.items[i].repuestos;
    if (!repuestosUsados?.length) continue;
    const ventaItemId = itemRows[i].id;
    for (const r of repuestosUsados) {
      const { error: linkError } = await supabase.from("venta_item_repuestos").insert({
        venta_item_id: ventaItemId,
        repuesto_id: r.repuestoId,
        cantidad: r.cantidad,
      });
      if (linkError) throw linkError;

      const { data: actual, error: readError } = await supabase
        .from("repuestos")
        .select("stock")
        .eq("id", r.repuestoId)
        .single();
      if (readError) throw readError;
      const { error: stockError } = await supabase
        .from("repuestos")
        .update({ stock: actual.stock - r.cantidad })
        .eq("id", r.repuestoId);
      if (stockError) throw stockError;
      await addMovimiento(
        "repuesto",
        r.repuestoId,
        `Usado en venta V-${ventaRow.numero}: -${r.cantidad} unidades`,
        "egreso",
      );
    }
  }

  // Pagos -- cada uno genera su movimiento de caja o de cuenta corriente.
  const concepto = `Venta V-${ventaRow.numero} · ${data.cliente}`;
  for (const pago of data.pagos) {
    const montoReal = montoConRecargo(pago.montoUsd, pago.recargoPct);
    if (pago.medio === "cuenta_corriente") {
      if (!data.clienteId) continue;
      await createMovimientoCC({
        clienteId: data.clienteId,
        tipo: "cargo",
        concepto,
        montoUsd: montoReal,
        ventaId: ventaRow.id,
      });
    } else if (pago.cajaId) {
      const monto = pago.caja === "ars" ? Math.round(montoReal * data.dolarVenta) : montoReal;
      const { error: movError } = await supabase.from("movimientos_caja").insert({
        caja_id: pago.cajaId,
        concepto,
        medio_pago: pago.medio,
        tipo: "ingreso",
        monto,
        usuario_id: data.vendedorId || null,
        usuario_nombre: data.vendedorNombre,
        venta_id: ventaRow.id,
      });
      if (movError) throw movError;
    }
  }

  const { data: row, error: selectError } = await supabase
    .from("ventas")
    .select(VENTA_COLS)
    .eq("id", ventaRow.id)
    .single();
  if (selectError) throw selectError;

  const tieneMovimientoCaja = data.pagos.some((p) => p.medio !== "cuenta_corriente" && p.cajaId);
  const tieneMovimientoCC = data.pagos.some((p) => p.medio === "cuenta_corriente");
  return toVenta(row as unknown as VentaRow, tieneMovimientoCaja, tieneMovimientoCC);
}

export type DeleteVentaOpts = {
  restituirEquipos: boolean;
  restituirRepuestos: boolean;
  eliminarMovimientosCaja: boolean;
  eliminarMovimientoCC: boolean;
};

/** Borra la venta (sus `venta_items` caen solos por `on delete cascade`,
 * y con ellos `venta_item_repuestos`). Cuatro reversiones independientes,
 * elegidas en el checkbox del modal de confirmación (`ventas-client.tsx`):
 * - `restituirEquipos`: los equipos vendidos vuelven a `disponible`.
 * - `restituirRepuestos`: los repuestos consumidos vuelven al stock.
 * - `eliminarMovimientosCaja` / `eliminarMovimientoCC`: borra también el
 *   movimiento generado por los pagos de esta venta -- si se deja en
 *   `false`, el movimiento sobrevive huérfano (`venta_id` vuelve a `null`
 *   solo por el `on delete set null` de la FK), como si fuera manual.
 *
 * `id` es el `Venta.id` de la app (`"V-1042"`) -- no el uuid real de la
 * fila, que `toVenta` nunca expone hacia afuera. Se resuelve acá contra
 * `numero` antes de tocar nada. */
export async function deleteVenta(id: string, opts: DeleteVentaOpts): Promise<void> {
  const supabase = createServerClient();
  const numero = Number(id.replace(/^V-/, ""));

  const { data: ventaRow, error: ventaError } = await supabase
    .from("ventas")
    .select("id")
    .eq("numero", numero)
    .single();
  if (ventaError) throw ventaError;

  if (opts.restituirEquipos) {
    const { data: items, error: itemsError } = await supabase
      .from("venta_items")
      .select("equipo_id")
      .eq("venta_id", ventaRow.id)
      .not("equipo_id", "is", null);
    if (itemsError) throw itemsError;

    const equipoIds = (items ?? []).map((i) => i.equipo_id as string);
    if (equipoIds.length > 0) {
      const { error: updError } = await supabase
        .from("equipos")
        .update({ estado: "disponible" })
        .in("id", equipoIds);
      if (updError) throw updError;
    }
  }

  if (opts.restituirRepuestos) {
    const { data: ventaItems, error: itemsError } = await supabase
      .from("venta_items")
      .select("id")
      .eq("venta_id", ventaRow.id);
    if (itemsError) throw itemsError;
    const ventaItemIds = (ventaItems ?? []).map((i) => i.id as string);

    if (ventaItemIds.length > 0) {
      const { data: usados, error: usadosError } = await supabase
        .from("venta_item_repuestos")
        .select("repuesto_id, cantidad")
        .in("venta_item_id", ventaItemIds);
      if (usadosError) throw usadosError;

      const porRepuesto = new Map<string, number>();
      for (const u of usados ?? []) {
        porRepuesto.set(u.repuesto_id, (porRepuesto.get(u.repuesto_id) ?? 0) + u.cantidad);
      }
      for (const [repuestoId, cantidad] of porRepuesto) {
        const { data: actual, error: readError } = await supabase
          .from("repuestos")
          .select("stock")
          .eq("id", repuestoId)
          .single();
        if (readError) throw readError;
        const { error: stockError } = await supabase
          .from("repuestos")
          .update({ stock: actual.stock + cantidad })
          .eq("id", repuestoId);
        if (stockError) throw stockError;
        await addMovimiento(
          "repuesto",
          repuestoId,
          `Devuelto al borrar venta ${id}: +${cantidad} unidades`,
          "ingreso",
        );
      }
    }
  }

  if (opts.eliminarMovimientosCaja) {
    const { error: movError } = await supabase
      .from("movimientos_caja")
      .delete()
      .eq("venta_id", ventaRow.id);
    if (movError) throw movError;
  }

  if (opts.eliminarMovimientoCC) {
    const { error: ccError } = await supabase
      .from("movimientos_cc")
      .delete()
      .eq("venta_id", ventaRow.id);
    if (ccError) throw ccError;
  }

  const { error } = await supabase.from("ventas").delete().eq("id", ventaRow.id);
  if (error) throw error;
}

/** Vendedores posibles para el selector de "Nueva venta" -- admin y
 * vendedor pueden figurar como vendedor de una operación. */
export async function listVendedores(): Promise<{ id: string; nombre: string }[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre")
    .in("rol", ["admin", "vendedor"])
    .order("nombre");
  if (error) throw error;
  return data;
}
