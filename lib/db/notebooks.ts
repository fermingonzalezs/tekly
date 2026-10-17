import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { requireUser } from "@/lib/auth";
import type { CelularStatus, Notebook, NotebookCondicion } from "@/lib/types";
import { addMovimiento } from "@/lib/db/inventario";
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
};

function toNotebook(row: NotebookRow): Notebook {
  return {
    id: row.id,
    modelo: row.modelo,
    cpu: row.cpu ?? "",
    memoria: row.memoria ?? "",
    almacenamiento: row.almacenamiento ?? "",
    pantalla: row.pantalla ?? "",
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
  };
}

const NOTEBOOK_COLS =
  "id, modelo, cpu, memoria, almacenamiento, pantalla, color, idioma, numero_serie, garantia, notas, costo_usd, precio_usd, estado, condicion, bateria";

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

export async function createNotebook(data: NotebookInput): Promise<Notebook> {
  const parsed = notebookSchema.parse(data);
  await validarSerieUnica(parsed.numeroSerie);
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("notebooks")
    .insert({
      modelo: parsed.modelo,
      cpu: parsed.cpu || null,
      memoria: parsed.memoria || null,
      almacenamiento: parsed.almacenamiento || null,
      pantalla: parsed.pantalla || null,
      color: parsed.color || null,
      idioma: parsed.idioma || null,
      numero_serie: parsed.numeroSerie || null,
      garantia: parsed.garantia || null,
      notas: parsed.notas || null,
      costo_usd: parsed.costoUsd,
      precio_usd: parsed.precioUsd,
      estado: parsed.estado,
      condicion: parsed.condicion,
      // La batería solo se guarda en las usadas (constraint en la base).
      bateria: parsed.condicion === "usado" ? parsed.bateria : null,
    })
    .select(NOTEBOOK_COLS)
    .single();
  if (error) throw mensajeDeError(error);
  await addMovimiento("notebook", row.id, "Ingreso a inventario", "ingreso");
  return toNotebook(row);
}

export async function updateNotebook(id: string, data: NotebookInput): Promise<Notebook> {
  const parsed = notebookSchema.parse(data);
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
      modelo: parsed.modelo,
      cpu: parsed.cpu || null,
      memoria: parsed.memoria || null,
      almacenamiento: parsed.almacenamiento || null,
      pantalla: parsed.pantalla || null,
      color: parsed.color || null,
      idioma: parsed.idioma || null,
      numero_serie: parsed.numeroSerie || null,
      garantia: parsed.garantia || null,
      notas: parsed.notas || null,
      costo_usd: parsed.costoUsd,
      precio_usd: parsed.precioUsd,
      estado: parsed.estado,
      condicion: parsed.condicion,
      // La batería solo se guarda en las usadas (constraint en la base).
      bateria: parsed.condicion === "usado" ? parsed.bateria : null,
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
  const parsed = rows.map((r) => notebookSchema.parse(r));
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("notebooks")
    .insert(
      parsed.map((p) => ({
        modelo: p.modelo,
        cpu: p.cpu || null,
        memoria: p.memoria || null,
        almacenamiento: p.almacenamiento || null,
        pantalla: p.pantalla || null,
        color: p.color || null,
        idioma: p.idioma || null,
        numero_serie: p.numeroSerie || null,
        garantia: p.garantia || null,
        notas: p.notas || null,
        costo_usd: p.costoUsd,
        precio_usd: p.precioUsd,
        estado: p.estado,
        condicion: p.condicion,
        bateria: p.condicion === "usado" ? p.bateria : null,
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
