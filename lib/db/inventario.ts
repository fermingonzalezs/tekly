import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { requireUser } from "@/lib/auth";
import { fmtDayMonth, fmtTime } from "@/lib/format";
import type {
  Equipo,
  EquipoStatus,
  Movimiento,
  OtroCategoria,
  OtroItem,
  OtroUnidad,
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
  await addMovimiento("equipo", row.id, "Ingreso a inventario");
  return toEquipo(row);
}

export async function updateEquipo(id: string, data: EquipoInput): Promise<Equipo> {
  const supabase = createServerClient();
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
  await addMovimiento("equipo", id, `Editado · estado: ${data.estado}`);
  return toEquipo(row);
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
  await addMovimiento("equipo", id, "Baja de inventario");
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
    usuario_id: user.id,
    usuario_nombre: user.nombre,
  }));
  const { error: movError } = await supabase.from("movimientos_stock").insert(movimientos);
  if (movError) throw movError;

  return { inserted: data.length, equipos: data.map(toEquipo) };
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
  const proveedorId = await resolveProveedorId(data.proveedor);
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
  await addMovimiento("repuesto", id, "Editado");
  return toRepuesto(row as unknown as RepuestoRow);
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
  await addMovimiento("repuesto", row.id, `Ingreso: +${cantidad} unidades`);
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
  await addMovimiento("repuesto", id, `Ingreso: +${cantidad} unidades`);
  return toRepuesto(row as unknown as RepuestoRow);
}

export async function recuentoRepuestos(draft: Record<string, number>): Promise<void> {
  const supabase = createServerClient();
  for (const [id, stock] of Object.entries(draft)) {
    const { error } = await supabase.from("repuestos").update({ stock }).eq("id", id);
    if (error) throw error;
    await addMovimiento("repuesto", id, `Recuento: stock ajustado a ${stock}`);
  }
}

/** Baja lógica (nada referencia `repuestos.id` con FK, pero se usa el mismo
 * criterio que equipos por consistencia: nunca un `DELETE` real, siempre
 * queda la baja en `movimientos_stock`). */
export async function deleteRepuesto(id: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("repuestos").update({ activo: false }).eq("id", id);
  if (error) throw error;
  await addMovimiento("repuesto", id, "Baja de inventario");
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
  await addMovimiento("otro", id, "Editado");
  return toOtro(row as unknown as OtroRow);
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
  await addMovimiento("otro", id, `Ingreso: +${cantidad} unidades`);
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
  await addMovimiento("otro", row.id, "Ingreso a inventario");
  return toOtro(row as unknown as OtroRow);
}

export async function recuentoOtros(draft: Record<string, number>): Promise<void> {
  const supabase = createServerClient();
  for (const [id, cantidad] of Object.entries(draft)) {
    const { error } = await supabase.from("otros_items").update({ cantidad }).eq("id", id);
    if (error) throw error;
    await addMovimiento("otro", id, `Recuento: cantidad ajustada a ${cantidad}`);
  }
}

/** Baja lógica, mismo criterio que equipos/repuestos. */
export async function deleteOtro(id: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("otros_items").update({ activo: false }).eq("id", id);
  if (error) throw error;
  await addMovimiento("otro", id, "Baja de inventario");
}

// ─────────────────────────── Movimientos de stock ───────────────────────────

type ItemType = "equipo" | "repuesto" | "otro";

export async function addMovimiento(itemType: ItemType, itemId: string, detalle: string) {
  const user = await requireUser();
  const supabase = createServerClient();
  const { error } = await supabase.from("movimientos_stock").insert({
    item_type: itemType,
    item_id: itemId,
    detalle,
    usuario_id: user.id,
    usuario_nombre: user.nombre,
  });
  if (error) throw error;
}

export async function listMovimientos(itemType: ItemType, itemId: string): Promise<Movimiento[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("movimientos_stock")
    .select("fecha, detalle, usuario_nombre")
    .eq("item_type", itemType)
    .eq("item_id", itemId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data.map((m) => ({
    fecha: fmtDayMonth(m.fecha),
    hora: fmtTime(m.fecha),
    detalle: m.detalle,
    usuario: m.usuario_nombre,
  }));
}
