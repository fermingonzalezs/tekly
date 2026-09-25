import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { requireUser, requireRole } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth/types";
import { fmtDayMonth, fmtTime } from "@/lib/format";
import { diffEquipo, diffRepuesto, diffOtro } from "@/lib/inventario-diff";
import type {
  Equipo,
  EquipoStatus,
  Movimiento,
  MovimientoItem,
  MovimientoTipo,
  OtroCategoria,
  OtroItem,
  OtroUnidad,
  Recuento,
  RecuentoLineaCantidad,
  RecuentoLineaEquipo,
  RecuentoResolucion,
  Repuesto,
} from "@/lib/types";

// ─────────────────────────── Equipos ───────────────────────────

type EquipoRow = {
  id: string;
  modelo: string;
  almacenamiento: string | null;
  color: string | null;
  imei: string | null;
  bateria: number | null;
  condicion: string | null;
  costo_usd: number;
  precio_usd: number;
  estado: EquipoStatus;
};

function toEquipo(row: EquipoRow): Equipo {
  return {
    id: row.id,
    modelo: row.modelo,
    almacenamiento: row.almacenamiento ?? "",
    color: row.color ?? "—",
    imei: row.imei ?? "—",
    bateria: row.bateria ?? 0,
    condicion: row.condicion ?? "",
    costoUsd: row.costo_usd,
    precioUsd: row.precio_usd,
    estado: row.estado,
  };
}

const EQUIPO_COLS =
  "id, modelo, almacenamiento, color, imei, bateria, condicion, costo_usd, precio_usd, estado";

export async function listEquipos(): Promise<Equipo[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("equipos")
    .select(EQUIPO_COLS)
    .eq("activo", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(toEquipo);
}

export type EquipoInput = {
  modelo: string;
  almacenamiento: string;
  color: string;
  imei: string;
  bateria: number;
  condicion: string;
  costoUsd: number;
  precioUsd: number;
  estado: EquipoStatus;
};

export async function createEquipo(data: EquipoInput): Promise<Equipo> {
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("equipos")
    .insert({
      modelo: data.modelo,
      almacenamiento: data.almacenamiento || null,
      color: data.color || null,
      imei: data.imei === "—" ? null : data.imei || null,
      bateria: data.bateria,
      condicion: data.condicion || null,
      costo_usd: data.costoUsd,
      precio_usd: data.precioUsd,
      estado: data.estado,
    })
    .select(EQUIPO_COLS)
    .single();
  if (error) throw error;
  await addMovimiento("equipo", row.id, "Ingreso a inventario", "ingreso");
  return toEquipo(row);
}

export async function updateEquipo(id: string, data: EquipoInput): Promise<Equipo> {
  const supabase = createServerClient();
  const { data: antesRow } = await supabase
    .from("equipos")
    .select(EQUIPO_COLS)
    .eq("id", id)
    .single();
  const { data: row, error } = await supabase
    .from("equipos")
    .update({
      modelo: data.modelo,
      almacenamiento: data.almacenamiento || null,
      color: data.color || null,
      imei: data.imei === "—" ? null : data.imei || null,
      bateria: data.bateria,
      condicion: data.condicion || null,
      costo_usd: data.costoUsd,
      precio_usd: data.precioUsd,
      estado: data.estado,
    })
    .eq("id", id)
    .select(EQUIPO_COLS)
    .single();
  if (error) throw error;
  const despues = toEquipo(row);
  const detalle = antesRow ? diffEquipo(toEquipo(antesRow), despues) : "Editado";
  await addMovimiento("equipo", id, detalle, "edicion");
  return despues;
}

/** Baja lógica -- nunca `DELETE` real: `venta_items.equipo_id` referencia
 * `equipos.id` con `NO ACTION`, así que un equipo que alguna vez se vendió
 * rompería el borrado en duro. Queda desactivado (afuera de `listEquipos`)
 * y con su baja registrada en `movimientos_stock`, igual que cualquier
 * otro cambio del ítem. */
export async function deleteEquipo(id: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("equipos").update({ activo: false }).eq("id", id);
  if (error) throw error;
  await addMovimiento("equipo", id, "Baja de inventario", "baja");
}

/** IMEIs ya cargados en la organización (sin nulos) -- usado por el
 * importador de equipos para descartar filas con IMEI repetido antes de
 * insertar (el bulk insert de abajo abortaría entero si alguna fila choca
 * con el `UNIQUE (organization_id, imei)` de la tabla). */
export async function listImeisExistentes(): Promise<Set<string>> {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("equipos").select("imei").not("imei", "is", null);
  if (error) throw error;
  return new Set(data.map((r) => r.imei as string));
}

/** Alta masiva (importación de equipos existentes): un solo insert para
 * `equipos` + un solo insert para `movimientos_stock` -- nunca un loop de
 * `addMovimiento`, que haría N round-trips y N `requireUser()` redundantes. */
export async function createEquiposBulk(
  rows: EquipoInput[],
): Promise<{ inserted: number; equipos: Equipo[] }> {
  if (rows.length === 0) return { inserted: 0, equipos: [] };
  const user = await requireUser();
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("equipos")
    .insert(
      rows.map((r) => ({
        modelo: r.modelo,
        almacenamiento: r.almacenamiento || null,
        color: r.color || null,
        imei: r.imei === "—" ? null : r.imei || null,
        bateria: r.bateria,
        condicion: r.condicion || null,
        costo_usd: r.costoUsd,
        precio_usd: r.precioUsd,
        estado: r.estado,
      })),
    )
    .select(EQUIPO_COLS);
  if (error) throw error;

  const movimientos = data.map((row) => ({
    item_type: "equipo" as const,
    item_id: row.id,
    detalle: "Importación inicial",
    tipo: "ingreso" as const,
    usuario_id: user.id,
    usuario_nombre: user.nombre,
  }));
  const { error: movError } = await supabase.from("movimientos_stock").insert(movimientos);
  if (movError) throw movError;

  return { inserted: data.length, equipos: data.map(toEquipo) };
}

/** Recuento (auditoría física): `draft` mapea id de equipo -> si se
 * encontró al revisarlo; `comentarios`, id de equipo -> nota libre cargada
 * al tildarlo "no encontrado" (ver `RecuentoLineaEquipo.comentario`, vacío
 * para el resto). Registra qué se encontró y qué no, pero NO toca
 * `equipos.estado` todavía -- queda `pendiente` hasta que un admin lo
 * revise (`resolverRecuento`). Solo las diferencias (esperaba una cosa,
 * contó otra) entran a `lineas`; lo que coincide con lo esperado igual deja
 * su registro en `movimientos_stock`, pero no requiere revisión. */
export async function crearRecuentoEquipos(
  draft: Record<string, boolean>,
  comentarios: Record<string, string>,
  comentarioGeneral?: string,
): Promise<Recuento> {
  const ids = Object.keys(draft);
  const user = await requireUser();
  const lineas: RecuentoLineaEquipo[] = [];

  if (ids.length > 0) {
    const supabase = createServerClient();
    const { data: actuales, error: readError } = await supabase
      .from("equipos")
      .select("id, modelo, almacenamiento, imei, estado")
      .in("id", ids);
    if (readError) throw readError;

    for (const eq of actuales) {
      const encontrado = draft[eq.id];
      const eraExtraviado = (eq.estado as EquipoStatus) === "extraviado";
      const detalle = `${eq.modelo} ${eq.almacenamiento ?? ""} · ${eq.imei ?? "—"}`.trim();
      if (encontrado && eraExtraviado) {
        await addMovimiento("equipo", eq.id, "Recuento: reapareció (pendiente de revisión)", "recuento");
        lineas.push({ itemId: eq.id, detalle, eraExtraviado: true, encontrado: true, resolucion: "pendiente" });
      } else if (encontrado) {
        await addMovimiento("equipo", eq.id, "Recuento: presente", "recuento");
      } else if (eraExtraviado) {
        await addMovimiento("equipo", eq.id, "Recuento: sigue sin encontrarse", "recuento");
      } else {
        const comentario = comentarios[eq.id]?.trim() || undefined;
        await addMovimiento(
          "equipo",
          eq.id,
          `Recuento: no encontrado (pendiente de revisión)${comentario ? ` -- ${comentario}` : ""}`,
          "recuento",
        );
        lineas.push({
          itemId: eq.id,
          detalle,
          eraExtraviado: false,
          encontrado: false,
          resolucion: "pendiente",
          comentario,
        });
      }
    }
  }

  return crearRecuento("equipos", user, lineas, comentarioGeneral);
}

// ─────────────────────────── Repuestos ───────────────────────────

type RepuestoRow = {
  id: string;
  sku: string | null;
  nombre: string;
  modelo: string | null;
  stock: number;
  stock_min: number;
  costo_usd: number;
  proveedores: { nombre: string } | null;
};

const REPUESTO_COLS =
  "id, sku, nombre, modelo, stock, stock_min, costo_usd, proveedores(nombre)";

function toRepuesto(row: RepuestoRow): Repuesto {
  return {
    id: row.id,
    sku: row.sku ?? "—",
    nombre: row.nombre,
    modelo: row.modelo ?? "—",
    stock: row.stock,
    stockMin: row.stock_min,
    costoUsd: row.costo_usd,
    proveedor: row.proveedores?.nombre ?? "—",
  };
}

/** `Repuesto.proveedor` es texto libre en la UI (no un selector), pero en
 * la base es una FK a `proveedores` (compartida con Compras) -- resuelve
 * el id creando el proveedor si el nombre es nuevo para esta organización. */
export async function resolveProveedorId(nombre: string): Promise<string | null> {
  const limpio = nombre.trim();
  if (!limpio || limpio === "—") return null;
  const supabase = createServerClient();
  const { data: existente } = await supabase
    .from("proveedores")
    .select("id")
    .ilike("nombre", limpio)
    .maybeSingle();
  if (existente) return existente.id;
  const { data: nuevo, error } = await supabase
    .from("proveedores")
    .insert({ nombre: limpio })
    .select("id")
    .single();
  if (error) throw error;
  return nuevo.id;
}

export async function listRepuestos(): Promise<Repuesto[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("repuestos")
    .select(REPUESTO_COLS)
    .eq("activo", true)
    .order("nombre");
  if (error) throw error;
  return (data as unknown as RepuestoRow[]).map(toRepuesto);
}

export type RepuestoInput = {
  sku: string;
  nombre: string;
  modelo: string;
  stock: number;
  stockMin: number;
  costoUsd: number;
  proveedor: string;
};

export async function updateRepuesto(id: string, data: RepuestoInput): Promise<Repuesto> {
  const supabase = createServerClient();
  const [proveedorId, { data: antesRow }] = await Promise.all([
    resolveProveedorId(data.proveedor),
    supabase.from("repuestos").select(REPUESTO_COLS).eq("id", id).single(),
  ]);
  const { data: row, error } = await supabase
    .from("repuestos")
    .update({
      sku: data.sku || null,
      nombre: data.nombre,
      modelo: data.modelo || null,
      stock: data.stock,
      stock_min: data.stockMin,
      costo_usd: data.costoUsd,
      proveedor_id: proveedorId,
    })
    .eq("id", id)
    .select(REPUESTO_COLS)
    .single();
  if (error) throw error;
  const despues = toRepuesto(row as unknown as RepuestoRow);
  const detalle = antesRow
    ? diffRepuesto(toRepuesto(antesRow as unknown as RepuestoRow), despues)
    : "Editado";
  await addMovimiento("repuesto", id, detalle, "edicion");
  return despues;
}

export async function crearRepuesto(
  nombre: string,
  precioCompra: number,
  cantidad: number,
): Promise<Repuesto> {
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("repuestos")
    .insert({ nombre, stock: cantidad, stock_min: 2, costo_usd: precioCompra })
    .select(REPUESTO_COLS)
    .single();
  if (error) throw error;
  await addMovimiento("repuesto", row.id, `Ingreso: +${cantidad} unidades`, "ingreso");
  return toRepuesto(row as unknown as RepuestoRow);
}

export async function ingresoRepuesto(
  id: string,
  cantidad: number,
  precioCompra: number,
): Promise<Repuesto> {
  const supabase = createServerClient();
  const { data: actual, error: readError } = await supabase
    .from("repuestos")
    .select("stock")
    .eq("id", id)
    .single();
  if (readError) throw readError;
  const { data: row, error } = await supabase
    .from("repuestos")
    .update({ stock: actual.stock + cantidad, costo_usd: precioCompra })
    .eq("id", id)
    .select(REPUESTO_COLS)
    .single();
  if (error) throw error;
  await addMovimiento("repuesto", id, `Ingreso: +${cantidad} unidades`, "ingreso");
  return toRepuesto(row as unknown as RepuestoRow);
}

/** Igual criterio que `crearRecuentoEquipos`: no ajusta `stock` todavía,
 * queda pendiente de revisión. `draft` solo trae los ítems que el usuario
 * efectivamente contó (el modal de recuento arranca "Cantidad real" vacío,
 * no pre-cargado con el stock del sistema) -- lo que no se cuenta no entra
 * acá, ni como movimiento ni como diferencia. `comentarios` es la nota por
 * fila del modal (id de repuesto -> texto), `comentarioGeneral` la nota
 * única de todo el recuento. */
export async function crearRecuentoRepuestos(
  draft: Record<string, number>,
  comentarios: Record<string, string> = {},
  comentarioGeneral?: string,
): Promise<Recuento> {
  const ids = Object.keys(draft);
  const user = await requireUser();
  const lineas: RecuentoLineaCantidad[] = [];

  if (ids.length > 0) {
    const supabase = createServerClient();
    const { data: actuales, error: readError } = await supabase
      .from("repuestos")
      .select("id, nombre, stock")
      .in("id", ids);
    if (readError) throw readError;

    for (const r of actuales) {
      const contado = draft[r.id];
      const comentario = comentarios[r.id]?.trim() || undefined;
      await addMovimiento(
        "repuesto",
        r.id,
        `Recuento: contado ${contado} (sistema ${r.stock})${comentario ? ` -- ${comentario}` : ""}`,
        "recuento",
      );
      if (contado !== r.stock) {
        lineas.push({
          itemId: r.id,
          detalle: r.nombre,
          cantidadSistema: r.stock,
          cantidadContada: contado,
          resolucion: "pendiente",
          comentario,
        });
      }
    }
  }

  return crearRecuento("repuestos", user, lineas, comentarioGeneral);
}

/** Baja lógica (nada referencia `repuestos.id` con FK, pero se usa el mismo
 * criterio que equipos por consistencia: nunca un `DELETE` real, siempre
 * queda la baja en `movimientos_stock`). */
export async function deleteRepuesto(id: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("repuestos").update({ activo: false }).eq("id", id);
  if (error) throw error;
  await addMovimiento("repuesto", id, "Baja de inventario", "baja");
}

// ─────────────────────────── Otros ───────────────────────────

type OtroRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: OtroCategoria;
  precio_usd: number;
  serializado: boolean;
  cantidad: number | null;
  costo_usd: number | null;
  unidades: OtroUnidad[] | null;
};

const OTRO_COLS =
  "id, nombre, descripcion, categoria, precio_usd, serializado, cantidad, costo_usd, unidades";

function toOtro(row: OtroRow): OtroItem {
  const base = {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion ?? undefined,
    categoria: row.categoria,
    precioUsd: row.precio_usd,
  };
  return row.serializado
    ? { ...base, serializado: true, unidades: row.unidades ?? [] }
    : { ...base, serializado: false, cantidad: row.cantidad ?? 0, costoUsd: row.costo_usd ?? 0 };
}

export async function listOtros(): Promise<OtroItem[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("otros_items")
    .select(OTRO_COLS)
    .eq("activo", true)
    .order("nombre");
  if (error) throw error;
  return (data as unknown as OtroRow[]).map(toOtro);
}

export async function updateOtro(id: string, item: OtroItem): Promise<OtroItem> {
  const supabase = createServerClient();
  const { data: antesRow } = await supabase
    .from("otros_items")
    .select(OTRO_COLS)
    .eq("id", id)
    .single();
  const { data: row, error } = await supabase
    .from("otros_items")
    .update({
      nombre: item.nombre,
      descripcion: item.descripcion ?? null,
      categoria: item.categoria,
      precio_usd: item.precioUsd,
      serializado: item.serializado,
      cantidad: item.serializado ? null : item.cantidad,
      costo_usd: item.serializado ? null : item.costoUsd,
      unidades: item.serializado ? item.unidades : null,
    })
    .eq("id", id)
    .select(OTRO_COLS)
    .single();
  if (error) throw error;
  const despues = toOtro(row as unknown as OtroRow);
  const detalle = antesRow ? diffOtro(toOtro(antesRow as unknown as OtroRow), despues) : "Editado";
  await addMovimiento("otro", id, detalle, "edicion");
  return despues;
}

export async function ingresoOtroExistente(
  id: string,
  cantidad: number,
  precioCompra: number,
  unidadesNuevas?: OtroUnidad[],
): Promise<OtroItem> {
  const supabase = createServerClient();
  const { data: actual, error: readError } = await supabase
    .from("otros_items")
    .select(OTRO_COLS)
    .eq("id", id)
    .single();
  if (readError) throw readError;
  const row = actual as unknown as OtroRow;

  const patch = row.serializado
    ? { unidades: [...(row.unidades ?? []), ...(unidadesNuevas ?? [])] }
    : { cantidad: (row.cantidad ?? 0) + cantidad, costo_usd: precioCompra };

  const { data: updated, error } = await supabase
    .from("otros_items")
    .update(patch)
    .eq("id", id)
    .select(OTRO_COLS)
    .single();
  if (error) throw error;
  await addMovimiento("otro", id, `Ingreso: +${cantidad} unidades`, "ingreso");
  return toOtro(updated as unknown as OtroRow);
}

export async function crearOtro(data: {
  nombre: string;
  precioCompra: number;
  cantidad: number;
  categoria: OtroCategoria;
  unidades?: OtroUnidad[];
}): Promise<OtroItem> {
  const supabase = createServerClient();
  const precioUsd = Math.round(data.precioCompra * 1.3);
  const serializado = !!data.unidades;
  const { data: row, error } = await supabase
    .from("otros_items")
    .insert({
      nombre: data.nombre,
      categoria: data.categoria,
      precio_usd: precioUsd,
      serializado,
      cantidad: serializado ? null : data.cantidad,
      costo_usd: serializado ? null : data.precioCompra,
      unidades: serializado ? data.unidades : null,
    })
    .select(OTRO_COLS)
    .single();
  if (error) throw error;
  await addMovimiento("otro", row.id, "Ingreso a inventario", "ingreso");
  return toOtro(row as unknown as OtroRow);
}

/** Igual criterio que `crearRecuentoRepuestos`: `draft` solo trae los ítems
 * contados (no serializados -- mismo alcance que tenía el recuento inmediato,
 * el cliente ya arma el `draft` así). */
export async function crearRecuentoOtros(
  draft: Record<string, number>,
  comentarios: Record<string, string> = {},
  comentarioGeneral?: string,
): Promise<Recuento> {
  const ids = Object.keys(draft);
  const user = await requireUser();
  const lineas: RecuentoLineaCantidad[] = [];

  if (ids.length > 0) {
    const supabase = createServerClient();
    const { data: actuales, error: readError } = await supabase
      .from("otros_items")
      .select("id, nombre, cantidad")
      .in("id", ids);
    if (readError) throw readError;

    for (const o of actuales) {
      const contado = draft[o.id];
      const sistema = o.cantidad ?? 0;
      const comentario = comentarios[o.id]?.trim() || undefined;
      await addMovimiento(
        "otro",
        o.id,
        `Recuento: contado ${contado} (sistema ${sistema})${comentario ? ` -- ${comentario}` : ""}`,
        "recuento",
      );
      if (contado !== sistema) {
        lineas.push({
          itemId: o.id,
          detalle: o.nombre,
          cantidadSistema: sistema,
          cantidadContada: contado,
          resolucion: "pendiente",
          comentario,
        });
      }
    }
  }

  return crearRecuento("otros", user, lineas, comentarioGeneral);
}

/** Baja lógica, mismo criterio que equipos/repuestos. */
export async function deleteOtro(id: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("otros_items").update({ activo: false }).eq("id", id);
  if (error) throw error;
  await addMovimiento("otro", id, "Baja de inventario", "baja");
}

// ─────────────────────────── Movimientos de stock ───────────────────────────

export type ItemType = "equipo" | "repuesto" | "otro";

export async function addMovimiento(
  itemType: ItemType,
  itemId: string,
  detalle: string,
  tipo: MovimientoTipo,
) {
  const user = await requireUser();
  const supabase = createServerClient();
  const { error } = await supabase.from("movimientos_stock").insert({
    item_type: itemType,
    item_id: itemId,
    detalle,
    tipo,
    usuario_id: user.id,
    usuario_nombre: user.nombre,
  });
  if (error) throw error;
}

export async function listMovimientos(itemType: ItemType, itemId: string): Promise<Movimiento[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("movimientos_stock")
    .select("fecha, detalle, usuario_nombre, tipo")
    .eq("item_type", itemType)
    .eq("item_id", itemId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data.map((m) => ({
    fecha: fmtDayMonth(m.fecha),
    hora: fmtTime(m.fecha),
    detalle: m.detalle,
    usuario: m.usuario_nombre,
    tipo: m.tipo as MovimientoTipo,
  }));
}

export type MovimientoStockBulk = {
  itemTipo: ItemType;
  itemId: string;
  tipo: MovimientoTipo;
  fechaISO: string;
  detalle: string;
};

/** Todos los movimientos que mueven stock (ingreso/egreso/baja) de todos
 * los ítems de una vez, para las métricas de Analíticas (antigüedad,
 * rotación, flujo) sin caer en el N+1 de `listMovimientos` (una query por
 * ítem). `edicion`/`recuento` no mueven stock, quedan afuera. Distinta de
 * `listMovimientosStock` (más abajo): esa resuelve nombres para la pestaña
 * "Movimientos" de /recuentos, esta trae los datos crudos sin resolver. */
export async function listMovimientosStockBulk(): Promise<MovimientoStockBulk[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("movimientos_stock")
    .select("item_type, item_id, tipo, fecha, detalle")
    .in("tipo", ["ingreso", "egreso", "baja"])
    .order("fecha", { ascending: true });
  if (error) throw error;
  return data.map((m) => ({
    itemTipo: m.item_type as ItemType,
    itemId: m.item_id,
    tipo: m.tipo as MovimientoTipo,
    fechaISO: m.fecha.slice(0, 10),
    detalle: m.detalle,
  }));
}

// ─────────────────────────── Recuentos ───────────────────────────
//
// Un recuento queda `pendiente` con sus diferencias (`lineas`) hasta que un
// admin lo revisa (`resolverRecuento`) -- recién ahí se toca el stock real.
// Mismo criterio que `Conciliacion` en Cajas. Las tres `crearRecuentoX` de
// arriba (Equipos/Repuestos/Otros) terminan acá.

type RecuentoRow = {
  id: string;
  tipo: Recuento["tipo"];
  fecha: string;
  responsable_nombre: string;
  estado: Recuento["estado"];
  revisado_por_nombre: string | null;
  revisado_en: string | null;
  lineas: RecuentoLineaEquipo[] | RecuentoLineaCantidad[];
  comentario_general: string | null;
};

const RECUENTO_COLS =
  "id, tipo, fecha, responsable_id, responsable_nombre, estado, revisado_por_id, revisado_por_nombre, revisado_en, lineas, comentario_general";

function toRecuento(row: RecuentoRow): Recuento {
  return {
    id: row.id,
    tipo: row.tipo,
    fecha: fmtDayMonth(row.fecha),
    hora: fmtTime(row.fecha),
    responsable: row.responsable_nombre,
    estado: row.estado,
    revisadoPor: row.revisado_por_nombre ?? undefined,
    revisadoEn: row.revisado_en
      ? `${fmtDayMonth(row.revisado_en)} ${fmtTime(row.revisado_en)}`
      : undefined,
    lineas: row.lineas,
    comentarioGeneral: row.comentario_general ?? undefined,
  };
}

async function crearRecuento(
  tipo: Recuento["tipo"],
  user: SessionUser,
  lineas: RecuentoLineaEquipo[] | RecuentoLineaCantidad[],
  comentarioGeneral?: string,
): Promise<Recuento> {
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("recuentos_stock")
    .insert({
      tipo,
      responsable_id: user.id,
      responsable_nombre: user.nombre,
      // Sin diferencias no hay nada que decidir -- se cierra solo, sin
      // `revisado_por` (no fue un admin el que lo resolvió).
      estado: lineas.length === 0 ? "revisado" : "pendiente",
      lineas,
      comentario_general: comentarioGeneral?.trim() || null,
    })
    .select(RECUENTO_COLS)
    .single();
  if (error) throw error;
  return toRecuento(row as unknown as RecuentoRow);
}

export async function listRecuentos(): Promise<Recuento[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("recuentos_stock")
    .select(RECUENTO_COLS)
    .order("fecha", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as unknown as RecuentoRow[]).map(toRecuento);
}

/** Admin revisa un recuento pendiente: cada línea necesita una resolución
 * (`confirmado`/`restaurado` para equipos, `ajustado`/`descartado` para
 * repuestos/otros). Recién acá se toca `equipos`/`repuestos`/`otros_items`
 * de verdad, y cada cambio deja su propio registro en `movimientos_stock`
 * (además del que ya había al contar) -- doble rastro: qué se contó y qué
 * se decidió hacer con eso. */
export async function resolverRecuento(
  id: string,
  resoluciones: Record<string, RecuentoResolucion>,
): Promise<Recuento> {
  const admin = await requireRole("admin");
  const supabase = createServerClient();
  const { data: row, error: readError } = await supabase
    .from("recuentos_stock")
    .select(RECUENTO_COLS)
    .eq("id", id)
    .single();
  if (readError) throw readError;
  const recuento = toRecuento(row as unknown as RecuentoRow);
  if (recuento.estado === "revisado") {
    throw new Error("Este recuento ya fue revisado.");
  }

  const lineasResueltas: (RecuentoLineaEquipo | RecuentoLineaCantidad)[] = [];
  for (const linea of recuento.lineas) {
    const resolucion = resoluciones[linea.itemId];
    if (!resolucion || resolucion === "pendiente") {
      throw new Error(`Falta resolver "${linea.detalle}".`);
    }

    if (recuento.tipo === "equipos") {
      const l = linea as RecuentoLineaEquipo;
      if (resolucion === "confirmado") {
        const { error } = await supabase
          .from("equipos")
          .update({ estado: "extraviado" })
          .eq("id", l.itemId);
        if (error) throw error;
        await addMovimiento(
          "equipo",
          l.itemId,
          `Recuento revisado por ${admin.nombre}: confirmado extraviado`,
          "recuento",
        );
      } else if (resolucion === "restaurado") {
        const { error } = await supabase
          .from("equipos")
          .update({ estado: "disponible" })
          .eq("id", l.itemId);
        if (error) throw error;
        await addMovimiento(
          "equipo",
          l.itemId,
          `Recuento revisado por ${admin.nombre}: restaurado a disponible`,
          "recuento",
        );
      } else if (resolucion === "descartado") {
        await addMovimiento(
          "equipo",
          l.itemId,
          `Recuento revisado por ${admin.nombre}: descartado, sin cambios`,
          "recuento",
        );
      } else {
        throw new Error(`Resolución inválida para un equipo: ${resolucion}`);
      }
      lineasResueltas.push({ ...l, resolucion });
    } else {
      const l = linea as RecuentoLineaCantidad;
      const tabla = recuento.tipo === "repuestos" ? "repuestos" : "otros_items";
      const campo = recuento.tipo === "repuestos" ? "stock" : "cantidad";
      const itemType: ItemType = recuento.tipo === "repuestos" ? "repuesto" : "otro";
      if (resolucion === "ajustado") {
        const { error } = await supabase
          .from(tabla)
          .update({ [campo]: l.cantidadContada })
          .eq("id", l.itemId);
        if (error) throw error;
        // Tipo propio ("ajuste", no "recuento"): esto sí toca el stock real
        // -- se distingue del resto de movimientos de recuento (que solo
        // documentan qué se contó/decidió) tanto en tipo como en el detalle,
        // que aclara de dónde salió el ajuste y cuánto se sumó/descontó.
        const delta = l.cantidadContada - l.cantidadSistema;
        const signo = delta > 0 ? "+" : "";
        await addMovimiento(
          itemType,
          l.itemId,
          `Ajuste por recuento (revisado por ${admin.nombre}): ${l.cantidadSistema} → ${l.cantidadContada} (${signo}${delta})`,
          "ajuste",
        );
      } else if (resolucion === "descartado") {
        await addMovimiento(
          itemType,
          l.itemId,
          `Recuento revisado por ${admin.nombre}: descartado, sin cambios`,
          "recuento",
        );
      } else {
        throw new Error(`Resolución inválida para ${recuento.tipo}: ${resolucion}`);
      }
      lineasResueltas.push({ ...l, resolucion });
    }
  }

  const { data: updated, error } = await supabase
    .from("recuentos_stock")
    .update({
      estado: "revisado",
      revisado_por_id: admin.id,
      revisado_por_nombre: admin.nombre,
      revisado_en: new Date().toISOString(),
      lineas: lineasResueltas,
    })
    .eq("id", id)
    .select(RECUENTO_COLS)
    .single();
  if (error) throw error;
  return toRecuento(updated as unknown as RecuentoRow);
}

/** Vista consolidada de `movimientos_stock` mezclando equipos/repuestos/
 * otros en una sola tabla (para /recuentos → pestaña "Movimientos"; el
 * historial de UN ítem, en su dialog, sigue usando `listMovimientos`). Sin
 * FK a una tabla fija (`item_id` apunta a una de tres según `item_type`),
 * así que el nombre se resuelve acá con un `.in()` por tipo en vez de un
 * join de SQL -- funciona incluso para ítems dados de baja porque nunca se
 * borran de verdad (`activo = false`), siguen estando para el lookup. */
export async function listMovimientosStock(filtro: {
  tipo?: MovimientoTipo;
  itemTipo?: ItemType;
} = {}): Promise<MovimientoItem[]> {
  const supabase = createServerClient();
  let query = supabase
    .from("movimientos_stock")
    .select("item_type, item_id, fecha, detalle, usuario_nombre, tipo")
    .order("fecha", { ascending: false })
    .limit(200);
  if (filtro.tipo) query = query.eq("tipo", filtro.tipo);
  if (filtro.itemTipo) query = query.eq("item_type", filtro.itemTipo);
  const { data, error } = await query;
  if (error) throw error;

  const idsPorTipo: Record<ItemType, Set<string>> = {
    equipo: new Set(),
    repuesto: new Set(),
    otro: new Set(),
  };
  for (const m of data) idsPorTipo[m.item_type as ItemType].add(m.item_id);

  const [equiposMap, repuestosMap, otrosMap] = await Promise.all([
    idsPorTipo.equipo.size
      ? supabase
          .from("equipos")
          .select("id, modelo, almacenamiento")
          .in("id", [...idsPorTipo.equipo])
          .then(({ data }) => new Map((data ?? []).map((e) => [e.id, `${e.modelo} ${e.almacenamiento ?? ""}`.trim()])))
      : Promise.resolve(new Map<string, string>()),
    idsPorTipo.repuesto.size
      ? supabase
          .from("repuestos")
          .select("id, nombre")
          .in("id", [...idsPorTipo.repuesto])
          .then(({ data }) => new Map((data ?? []).map((r) => [r.id, r.nombre])))
      : Promise.resolve(new Map<string, string>()),
    idsPorTipo.otro.size
      ? supabase
          .from("otros_items")
          .select("id, nombre")
          .in("id", [...idsPorTipo.otro])
          .then(({ data }) => new Map((data ?? []).map((o) => [o.id, o.nombre])))
      : Promise.resolve(new Map<string, string>()),
  ]);
  const nombrePorTipo: Record<ItemType, Map<string, string>> = {
    equipo: equiposMap,
    repuesto: repuestosMap,
    otro: otrosMap,
  };

  return data.map((m) => ({
    fecha: fmtDayMonth(m.fecha),
    hora: fmtTime(m.fecha),
    detalle: m.detalle,
    usuario: m.usuario_nombre,
    tipo: m.tipo as MovimientoTipo,
    itemTipo: m.item_type as ItemType,
    itemNombre: nombrePorTipo[m.item_type as ItemType].get(m.item_id) ?? "—",
  }));
}
