import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { requireUser } from "@/lib/auth";
import type { CelularStatus, Notebook, NotebookCondicion, Variante } from "@/lib/types";
import { addMovimiento, detalleIngreso, type IngresoCompra } from "@/lib/db/inventario";
import { varianteParaUnidad, variantesParaUnidades } from "@/lib/db/variantes";
import { notebookSchema, type NotebookInput } from "@/lib/notebooks";

const ESTADOS: CelularStatus[] = [
  "en_revision",
  "disponible",
  "reservado",
  "vendido",
  "extraviado",
];

export type { NotebookInput };

type NotebookRow = {
  id: string;
  modelo: string;
  cpu: string | null;
  memoria: string | null;
  almacenamiento: string | null;
  pantalla: string | null;
  gpu: string | null;
  color: string | null;
  idioma: string | null;
  numero_serie: string | null;
  garantia: string | null;
  notas: string | null;
  costo_usd: number;
  precio_usd: number;
  estado: CelularStatus;
  condicion: NotebookCondicion;
  bateria: number | null;
  variante_id: string | null;
  precio_propio: boolean;
  precio_mayorista_usd?: number | string | null;
};

function toNotebook(row: NotebookRow): Notebook {
  return {
    id: row.id,
    modelo: row.modelo,
    cpu: row.cpu ?? "",
    memoria: row.memoria ?? "",
    almacenamiento: row.almacenamiento ?? "",
    pantalla: row.pantalla ?? "",
    gpu: row.gpu ?? "",
    color: row.color ?? "",
    idioma: row.idioma ?? "",
    numeroSerie: row.numero_serie ?? "",
    garantia: row.garantia ?? "",
    notas: row.notas ?? "",
    costoUsd: row.costo_usd,
    precioUsd: row.precio_usd,
    estado: row.estado,
    condicion: row.condicion,
    bateria: row.bateria,
    // Nullable solo hasta aplicar el NOT NULL (ver plan 024).
    varianteId: row.variante_id ?? "",
    precioPropio: row.precio_propio,
    precioMayoristaUsd:
      row.precio_mayorista_usd === null || row.precio_mayorista_usd === undefined
        ? null
        : Number(row.precio_mayorista_usd),
  };
}

/** Campos que la variante define en la notebook: modelo, memoria,
 * almacenamiento, condición y (salvo precio propio) el precio. Lo que mande
 * el cliente para esos campos no se usa. */
function camposDeVariante(data: NotebookInput, variante: Variante) {
  const condicion: NotebookCondicion = variante.condicion === "nuevo" ? "nuevo" : "usado";
  return {
    variante_id: variante.id,
    modelo: variante.modelo,
    memoria: variante.memoria || null,
    almacenamiento: variante.almacenamiento || null,
    condicion,
    precio_usd: data.precioPropio ? data.precioUsd : variante.precioUsd,
    precio_propio: data.precioPropio,
    // Omitido = no se toca (un cambio de estado no borra el mayorista).
    ...(data.precioMayoristaUsd !== undefined
      ? { precio_mayorista_usd: data.precioMayoristaUsd }
      : {}),
    // La batería solo se guarda en las usadas (constraint en la base).
    bateria: condicion === "usado" ? data.bateria : null,
  };
}

/** El schema valida la batería contra la condición: se valida con la de la
 * variante, no con la que mandó el cliente. */
function conDatosDeVariante(data: NotebookInput, variante: Variante): NotebookInput {
  return {
    ...data,
    modelo: variante.modelo,
    memoria: variante.memoria,
    almacenamiento: variante.almacenamiento,
    condicion: variante.condicion === "nuevo" ? "nuevo" : "usado",
  };
}

const NOTEBOOK_COLS =
  "id, modelo, cpu, memoria, almacenamiento, pantalla, gpu, color, idioma, numero_serie, garantia, notas, costo_usd, precio_usd, estado, condicion, bateria, variante_id, precio_propio, precio_mayorista_usd";

export async function listNotebooks(): Promise<Notebook[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("notebooks")
    .select(NOTEBOOK_COLS)
    .eq("activo", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(toNotebook);
}

async function validarSerieUnica(numeroSerie: string, excluirId?: string) {
  if (!numeroSerie) return;
  const supabase = createServerClient();
  let query = supabase
    .from("notebooks")
    .select("id")
    .eq("numero_serie", numeroSerie)
    .limit(1);
  if (excluirId) query = query.neq("id", excluirId);
  const { data, error } = await query;
  if (error) throw error;
  if (data.length > 0) {
    throw new Error(`Ya existe una notebook con el número de serie «${numeroSerie}»`);
  }
}

function mensajeDeError(error: { code?: string; message: string }) {
  if (error.code === "23505") {
    return new Error("Ya existe una notebook con ese número de serie");
  }
  return error;
}

export async function createNotebook(
  data: NotebookInput,
  compra?: IngresoCompra,
): Promise<Notebook> {
  const variante = await varianteParaUnidad(data.varianteId, "notebook");
  const parsed = notebookSchema.parse(conDatosDeVariante(data, variante));
  await validarSerieUnica(parsed.numeroSerie);
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("notebooks")
    .insert({
      ...camposDeVariante(parsed, variante),
      cpu: parsed.cpu || null,
      pantalla: parsed.pantalla || null,
      gpu: parsed.gpu || null,
      color: parsed.color || null,
      idioma: parsed.idioma || null,
      numero_serie: parsed.numeroSerie || null,
      garantia: parsed.garantia || null,
      notas: parsed.notas || null,
      costo_usd: parsed.costoUsd,
      estado: parsed.estado,
      ...(compra ? { compra_id: compra.compraId } : {}),
    })
    .select(NOTEBOOK_COLS)
    .single();
  if (error) throw mensajeDeError(error);
  await addMovimiento("notebook", row.id, detalleIngreso(compra), "ingreso", compra?.compraId);
  return toNotebook(row);
}

export async function updateNotebook(id: string, data: NotebookInput): Promise<Notebook> {
  const variante = await varianteParaUnidad(data.varianteId, "notebook");
  const parsed = notebookSchema.parse(conDatosDeVariante(data, variante));
  await validarSerieUnica(parsed.numeroSerie, id);
  const supabase = createServerClient();
  const { data: antesRow } = await supabase
    .from("notebooks")
    .select(NOTEBOOK_COLS)
    .eq("id", id)
    .single();
  const { data: row, error } = await supabase
    .from("notebooks")
    .update({
      ...camposDeVariante(parsed, variante),
      cpu: parsed.cpu || null,
      pantalla: parsed.pantalla || null,
      gpu: parsed.gpu || null,
      color: parsed.color || null,
      idioma: parsed.idioma || null,
      numero_serie: parsed.numeroSerie || null,
      garantia: parsed.garantia || null,
      notas: parsed.notas || null,
      costo_usd: parsed.costoUsd,
      estado: parsed.estado,
    })
    .eq("id", id)
    .select(NOTEBOOK_COLS)
    .single();
  if (error) throw mensajeDeError(error);
  const despues = toNotebook(row);
  const detalle = antesRow ? diffNotebook(toNotebook(antesRow), despues) : "Editado";
  await addMovimiento("notebook", id, detalle, "edicion");
  return despues;
}

/** Baja lógica, mismo criterio que celulares/repuestos: `venta_items.
 * notebook_id` puede referenciar la fila, así que nunca se borra en duro. */
export async function deleteNotebook(id: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("notebooks").update({ activo: false }).eq("id", id);
  if (error) throw error;
  await addMovimiento("notebook", id, "Baja de inventario", "baja");
}

const CAMPOS_NOTEBOOK: { key: keyof Notebook; label: string }[] = [
  { key: "modelo", label: "modelo" },
  { key: "cpu", label: "CPU" },
  { key: "memoria", label: "memoria" },
  { key: "almacenamiento", label: "almacenamiento" },
  { key: "pantalla", label: "pantalla" },
  { key: "gpu", label: "placa de video" },
  { key: "color", label: "color" },
  { key: "idioma", label: "idioma" },
  { key: "numeroSerie", label: "N.º de serie" },
  { key: "garantia", label: "garantía" },
  { key: "costoUsd", label: "costo" },
  { key: "precioUsd", label: "precio" },
  { key: "estado", label: "estado" },
  { key: "condicion", label: "condición" },
  { key: "bateria", label: "batería %" },
];

export function diffNotebook(antes: Notebook, despues: Notebook): string {
  const cambios = CAMPOS_NOTEBOOK.filter(({ key }) => antes[key] !== despues[key]).map(
    ({ key, label }) => {
      if (key === "costoUsd") return `costo U$ ${antes.costoUsd} → U$ ${despues.costoUsd}`;
      if (key === "precioUsd") return `precio U$ ${antes.precioUsd} → U$ ${despues.precioUsd}`;
      return `${label} ${antes[key] ?? "—"} → ${despues[key] ?? "—"}`;
    },
  );
  return cambios.length ? cambios.join(", ") : "Editado (sin cambios)";
}

export { ESTADOS as NOTEBOOK_ESTADOS };

export async function listSeriesExistentes(): Promise<Set<string>> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("notebooks")
    .select("numero_serie")
    .not("numero_serie", "is", null);
  if (error) throw error;
  return new Set(data.map((r) => r.numero_serie as string));
}

/** Alta masiva (importación de notebooks existentes): un solo insert para
 * `notebooks` + uno para `movimientos_stock`, nunca un loop de
 * `createNotebook`. Revalida cada fila con `notebookSchema`. */
export async function createNotebooksBulk(
  rows: NotebookInput[],
): Promise<{ inserted: number; notebooks: Notebook[] }> {
  if (rows.length === 0) return { inserted: 0, notebooks: [] };
  const user = await requireUser();
  const variantes = await variantesParaUnidades(rows.map((r) => r.varianteId), "notebook");
  const filas = rows.map((r) => {
    const variante = variantes.get(r.varianteId);
    if (!variante) throw new Error("Alguna fila quedó sin una variante válida.");
    return { variante, parsed: notebookSchema.parse(conDatosDeVariante(r, variante)) };
  });
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("notebooks")
    .insert(
      filas.map(({ variante, parsed: p }) => ({
        ...camposDeVariante(p, variante),
        cpu: p.cpu || null,
        pantalla: p.pantalla || null,
        gpu: p.gpu || null,
        color: p.color || null,
        idioma: p.idioma || null,
        numero_serie: p.numeroSerie || null,
        garantia: p.garantia || null,
        notas: p.notas || null,
        costo_usd: p.costoUsd,
        estado: p.estado,
      })),
    )
    .select(NOTEBOOK_COLS);
  if (error) throw mensajeDeError(error);

  const movimientos = data.map((row) => ({
    item_type: "notebook" as const,
    item_id: row.id,
    detalle: "Importación inicial",
    tipo: "ingreso" as const,
    usuario_id: user.id,
    usuario_nombre: user.nombre,
  }));
  const { error: movError } = await supabase.from("movimientos_stock").insert(movimientos);
  if (movError) throw movError;

  return { inserted: data.length, notebooks: data.map(toNotebook) };
}
