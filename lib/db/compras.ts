import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { requireUser } from "@/lib/auth";
import {
  addMovimiento,
  crearOtro,
  crearRepuesto,
  createCelular,
  deleteCelular,
  ingresoOtroExistente,
  ingresoRepuesto,
  listImeisExistentes,
  resolveProveedorId,
  type IngresoCompra,
} from "@/lib/db/inventario";
import { createNotebook, deleteNotebook, listSeriesExistentes } from "@/lib/db/notebooks";
import {
  costoFinalUnitario,
  erroresCompraStock,
  prorratearCostos,
  resumenCompraStock,
  serieDeItem,
  snapshotItems,
  type ItemCompraStock,
} from "@/lib/compras";
import type {
  Checklist,
  Compra,
  CompraEstado,
  CompraItem,
  IngresoStock,
  MedioPago,
  OtroUnidad,
  Pago,
} from "@/lib/types";

type CompraRow = {
  id: string;
  numero: number;
  fecha: string;
  origen: "proveedor" | "canje";
  proveedor_nombre: string | null;
  cliente_id: string | null;
  cliente_nombre: string | null;
  venta: { numero: number; pagos: Pago[] | null } | { numero: number; pagos: Pago[] | null }[] | null;
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
  sube_stock: boolean;
  costos_adicionales_usd: number;
  notas: string | null;
};

const COMPRA_COLS =
  "id, numero, fecha, origen, proveedor_nombre, cliente_id, cliente_nombre, venta:ventas(numero, pagos), items, total_usd, medio_pago, caja_id, estado, monto_ars, cotizacion, marca, imei, checklist, aclaraciones, sube_stock, costos_adicionales_usd, notas";

function toCompra(row: CompraRow): Compra {
  const venta = Array.isArray(row.venta) ? row.venta[0] : row.venta;
  const compraId = `C-${row.numero}`;
  const celularId = (venta?.pagos ?? []).find(
    (p) => p.medio === "canje" && p.compraId === compraId,
  )?.celularId;
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
    celularId,
    subeStock: row.sube_stock,
    costosAdicionalesUsd: Number(row.costos_adicionales_usd ?? 0),
    notas: row.notas ?? undefined,
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
 * `origen: "canje"` + `clienteId`/`clienteNombre`/`ventaId`.
 *
 * **Toda compra tiene proveedor**: en un canje el proveedor es el cliente
 * que entregó el equipo (se guarda en `proveedor_nombre`/`proveedor_id`,
 * además de `cliente_id`/`cliente_nombre`). Sin proveedor, error. */
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
  /** Solo canje: el celular recibido, para dejarle `compra_id`. */
  celularId?: string;
  /** Plan 025: ítems que suben al stock. Con esto, `items`/`totalUsd` se
   * recalculan en el server (nunca se confía en los del cliente), la compra
   * nace `recibida` y se crean las unidades. */
  stock?: ItemCompraStock[];
  costosAdicionalesUsd?: number;
  notas?: string;
  /** Nombre del usuario logueado -- lo resuelve `createCompraAction` con
   * `requireUser()`; la puerta de auth vive en `actions.ts`, no acá. */
  usuarioNombre: string;
}): Promise<Compra> {
  const origen = data.origen ?? "proveedor";
  const subeStock = origen === "proveedor" && !!data.stock;
  const adicional = Math.max(0, data.costosAdicionalesUsd ?? 0);
  if (subeStock) {
    const tipos = new Set(["celular", "notebook", "repuesto", "otro"]);
    if (!data.stock!.every((it) => tipos.has(it?.tipo))) throw new Error("Ítem de compra inválido.");
    const [imeis, series] = await Promise.all([listImeisExistentes(), listSeriesExistentes()]);
    const errores = erroresCompraStock(data.stock!, [...imeis, ...series]);
    if (errores.length > 0) throw new Error(errores.join(" "));
    data = {
      ...data,
      items: snapshotItems(data.stock!, adicional),
      totalUsd: resumenCompraStock(data.stock!, adicional).totalUsd,
      estado: "recibida",
    };
  }
  const proveedorNombre = (
    origen === "canje" ? data.clienteNombre ?? data.proveedor ?? "" : data.proveedor ?? ""
  ).trim();
  if (!proveedorNombre) {
    throw new Error(
      origen === "canje"
        ? "El canje necesita el cliente que entrega el equipo."
        : "El proveedor es obligatorio.",
    );
  }
  const proveedorId = await resolveProveedorId(proveedorNombre);
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("compras")
    .insert({
      origen,
      proveedor_id: proveedorId,
      proveedor_nombre: proveedorNombre,
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
      sube_stock: subeStock,
      costos_adicionales_usd: subeStock ? adicional : 0,
      notas: data.notas?.trim() || null,
    })
    .select(COMPRA_COLS)
    .single();
  if (error) throw error;
  const compraUuid = row.id;

  if (origen === "canje" && data.celularId) {
    const { error: linkError } = await supabase
      .from("celulares")
      .update({ compra_id: compraUuid })
      .eq("id", data.celularId);
    if (linkError) throw linkError;
  }

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
      concepto: `Compra C-${row.numero} · ${proveedorNombre}`,
      medio_pago: data.medioPago,
      tipo: "egreso",
      monto,
      cotizacion,
      usuario_nombre: data.usuarioNombre,
      compra_id: row.id,
    });
    if (movError) throw movError;
  }

  if (subeStock) {
    try {
      await ingresarItems(data.stock!, adicional, { compraId: compraUuid, numero: row.numero });
    } catch (err) {
      // Sin transacción real (mismo criterio que `createVenta`): se deshace
      // lo que alcanzó a crearse para que reintentar no duplique stock.
      let compensado = true;
      try {
        await deleteCompra(`C-${row.numero}`, { eliminarMovimientoCaja: true, quitarDelStock: true });
      } catch {
        compensado = false;
      }
      const motivo = err instanceof Error ? err.message : "Error al cargar el stock";
      throw new Error(
        compensado
          ? `${motivo} No se guardó nada: corregilo y volvé a intentar.`
          : `${motivo} Quedó la compra C-${row.numero} a medio cargar: revisala antes de reintentar.`,
      );
    }
  }

  return toCompra(row as unknown as CompraRow);
}

function mensajeIngreso(err: unknown, it: ItemCompraStock): Error {
  const code = (err as { code?: string }).code;
  if (code === "23505") {
    const serie = serieDeItem(it);
    return new Error(`El IMEI/serie ${serie || "de"} «${it.detalle}» ya está en el stock.`);
  }
  return err instanceof Error ? err : new Error(String((err as { message?: string }).message ?? err));
}

/** Crea las unidades/ítems de cada renglón (costo con su parte de los
 * adicionales) y su fila en `compra_items`, una por una: si algo falla, lo
 * ya creado queda referenciado y `deleteCompra` lo puede deshacer. */
async function ingresarItems(
  items: ItemCompraStock[],
  adicionalUsd: number,
  compra: IngresoCompra,
): Promise<void> {
  const user = await requireUser();
  const supabase = createServerClient();
  const adicionales = prorratearCostos(items, adicionalUsd);

  for (const [i, it] of items.entries()) {
    const costo = costoFinalUnitario(it, adicionales[i]);
    const fila: Record<string, unknown> = {
      compra_id: compra.compraId,
      tipo: it.tipo,
      detalle: it.detalle,
      cantidad: it.cantidad,
      costo_usd: it.costoUsd,
      costo_adicional_usd: adicionales[i],
      serie: serieDeItem(it) || null,
      usuario_nombre: user.nombre,
    };
    try {
      if (it.tipo === "celular") {
        const c = await createCelular({ ...it.celular, costoUsd: costo }, compra);
        Object.assign(fila, { celular_id: c.id, variante_id: c.varianteId || null });
      } else if (it.tipo === "notebook") {
        const n = await createNotebook({ ...it.notebook, costoUsd: costo }, compra);
        Object.assign(fila, { notebook_id: n.id, variante_id: n.varianteId || null });
      } else if (it.tipo === "repuesto") {
        const r = it.repuestoId
          ? await ingresoRepuesto(it.repuestoId, it.cantidad, costo, compra)
          : await crearRepuesto(it.nombre!.trim(), costo, it.cantidad, compra);
        fila.repuesto_id = r.id;
      } else {
        const extra = costo - it.costoUsd;
        const unidades = it.unidades?.map((u) => ({
          ...u,
          costoUsd: Math.round((u.costoUsd + extra) * 100) / 100,
        }));
        const o = it.otroId
          ? await ingresoOtroExistente(it.otroId, it.cantidad, costo, unidades, compra)
          : await crearOtro(
              {
                nombre: it.nuevo!.nombre.trim(),
                precioCompra: costo,
                cantidad: it.cantidad,
                categoria: it.nuevo!.categoria,
                unidades,
                precioVenta: it.nuevo!.precioVenta,
              },
              compra,
            );
        fila.otro_id = o.id;
        if (unidades?.length) fila.serie = unidades.map((u) => u.serial).join(", ");
      }
    } catch (err) {
      throw mensajeIngreso(err, it);
    }
    const { error } = await supabase.from("compra_items").insert(fila);
    if (error) throw error;
  }
}

export type DeleteCompraOpciones = {
  /** Borra también el egreso que generó la compra en `movimientos_caja` --
   * si es `false`, el movimiento sobrevive huérfano (`compra_id` vuelve a
   * `null` por el `on delete set null` de la FK), como si fuera manual. */
  eliminarMovimientoCaja?: boolean;
  /** Plan 025: saca del stock lo que ingresó con la compra. Celulares y
   * notebooks solo si siguen `en_revision`/`disponible` (baja lógica);
   * repuestos y otros restan la cantidad (sin bajar de 0). */
  quitarDelStock?: boolean;
};

/** Lo que no se pudo sacar del stock (ya vendido, reservado o movido). */
export type DeleteCompraResultado = { conservados: string[] };

type CompraItemRow = {
  tipo: IngresoStock["tipo"];
  detalle: string;
  cantidad: number;
  serie: string | null;
  celular_id: string | null;
  notebook_id: string | null;
  repuesto_id: string | null;
  otro_id: string | null;
};

const ESTADOS_QUE_SE_SACAN = ["en_revision", "disponible"];

async function quitarDelStock(compraUuid: string, numero: number): Promise<string[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("compra_items")
    .select("tipo, detalle, cantidad, serie, celular_id, notebook_id, repuesto_id, otro_id")
    .eq("compra_id", compraUuid);
  if (error) throw error;
  const conservados: string[] = [];
  const detalle = `Baja por eliminar la compra C-${numero}`;

  for (const it of data as CompraItemRow[]) {
    if (it.celular_id || it.notebook_id) {
      const tabla = it.celular_id ? "celulares" : "notebooks";
      const id = (it.celular_id ?? it.notebook_id)!;
      const { data: u, error: e } = await supabase
        .from(tabla)
        .select("estado, activo")
        .eq("id", id)
        .maybeSingle();
      if (e) throw e;
      if (!u || !u.activo) continue;
      if (!ESTADOS_QUE_SE_SACAN.includes(u.estado)) {
        conservados.push(it.detalle);
        continue;
      }
      if (it.celular_id) await deleteCelular(id);
      else await deleteNotebook(id);
    } else if (it.repuesto_id) {
      const { data: r, error: e } = await supabase
        .from("repuestos")
        .select("stock")
        .eq("id", it.repuesto_id)
        .maybeSingle();
      if (e) throw e;
      if (!r) continue;
      const nuevo = Math.max(0, r.stock - it.cantidad);
      if (r.stock < it.cantidad) conservados.push(`${it.detalle} (quedaban ${r.stock})`);
      const { error: ue } = await supabase.from("repuestos").update({ stock: nuevo }).eq("id", it.repuesto_id);
      if (ue) throw ue;
      await addMovimiento("repuesto", it.repuesto_id, `${detalle}: −${r.stock - nuevo} unidades`, "egreso");
    } else if (it.otro_id) {
      const { data: o, error: e } = await supabase
        .from("otros_items")
        .select("serializado, cantidad, unidades")
        .eq("id", it.otro_id)
        .maybeSingle();
      if (e) throw e;
      if (!o) continue;
      let patch: Record<string, unknown>;
      let sacadas: number;
      if (o.serializado) {
        const seriales = new Set((it.serie ?? "").split(",").map((x) => x.trim()).filter(Boolean));
        const unidades = (o.unidades ?? []) as OtroUnidad[];
        const quedan = unidades.filter(
          (u) => !(seriales.has(u.serial) && (u.estado ?? "disponible") === "disponible"),
        );
        sacadas = unidades.length - quedan.length;
        if (sacadas < seriales.size) conservados.push(`${it.detalle} (${seriales.size - sacadas} ya vendidas)`);
        patch = { unidades: quedan };
      } else {
        const actual = o.cantidad ?? 0;
        const nuevo = Math.max(0, actual - it.cantidad);
        sacadas = actual - nuevo;
        if (actual < it.cantidad) conservados.push(`${it.detalle} (quedaban ${actual})`);
        patch = { cantidad: nuevo };
      }
      const { error: ue } = await supabase.from("otros_items").update(patch).eq("id", it.otro_id);
      if (ue) throw ue;
      await addMovimiento("otro", it.otro_id, `${detalle}: −${sacadas} unidades`, "egreso");
    }
  }
  return conservados;
}

export async function deleteCompra(
  id: string,
  opciones: DeleteCompraOpciones = {},
): Promise<DeleteCompraResultado> {
  const supabase = createServerClient();
  const numero = Number(id.replace(/^C-/, ""));

  const { data: compraRow, error: compraError } = await supabase
    .from("compras")
    .select("id")
    .eq("numero", numero)
    .single();
  if (compraError) throw compraError;

  const conservados = opciones.quitarDelStock ? await quitarDelStock(compraRow.id, numero) : [];

  if (opciones.eliminarMovimientoCaja) {
    const { error: movError } = await supabase
      .from("movimientos_caja")
      .delete()
      .eq("compra_id", compraRow.id);
    if (movError) throw movError;
  }

  const { error } = await supabase.from("compras").delete().eq("id", compraRow.id);
  if (error) throw error;
  return { conservados };
}

/** Historial «Ingresos»: un renglón por ítem de una compra que subió al
 * stock, del más nuevo al más viejo. */
export async function listIngresos(): Promise<IngresoStock[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("compra_items")
    .select(
      "id, tipo, detalle, cantidad, costo_usd, costo_adicional_usd, serie, usuario_nombre, created_at, celular_id, notebook_id, repuesto_id, otro_id, compra:compras(numero, fecha, proveedor_nombre)",
    )
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  type Row = CompraItemRow & {
    id: string;
    costo_usd: number;
    costo_adicional_usd: number;
    usuario_nombre: string | null;
    created_at: string;
    compra: { numero: number; fecha: string; proveedor_nombre: string | null } | null;
  };
  return (data as unknown as Row[]).map((r) => {
    const fecha = r.compra?.fecha ?? r.created_at;
    return {
      id: r.id,
      compraId: r.compra ? `C-${r.compra.numero}` : "—",
      fecha: new Date(fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }),
      fechaISO: fecha.slice(0, 10),
      tipo: r.tipo,
      detalle: r.detalle,
      cantidad: r.cantidad,
      costoUsd: costoFinalUnitario(
        { cantidad: r.cantidad, costoUsd: Number(r.costo_usd) },
        Number(r.costo_adicional_usd),
      ),
      serie: r.serie ?? undefined,
      proveedor: r.compra?.proveedor_nombre ?? undefined,
      usuario: r.usuario_nombre ?? undefined,
      celularId: r.celular_id ?? undefined,
      notebookId: r.notebook_id ?? undefined,
      repuestoId: r.repuesto_id ?? undefined,
      otroId: r.otro_id ?? undefined,
    };
  });
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
