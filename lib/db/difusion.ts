import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { fmtMonthYear } from "@/lib/format";
import type { DifusionSeccion, ListaDifusion } from "@/lib/types";

type ListaRow = {
  id: string;
  nombre: string;
  mensaje_inicial: string | null;
  mensaje_final: string | null;
  descuento_tipo: ListaDifusion["descuentoTipo"];
  descuento_valor: number;
  secciones: DifusionSeccion[];
  created_at: string;
};

const COLS =
  "id, nombre, mensaje_inicial, mensaje_final, descuento_tipo, descuento_valor, secciones, created_at";

function toLista(row: ListaRow): ListaDifusion {
  return {
    id: row.id,
    nombre: row.nombre,
    mensajeInicial: row.mensaje_inicial ?? "",
    mensajeFinal: row.mensaje_final ?? "",
    descuentoTipo: row.descuento_tipo,
    descuentoValor: row.descuento_valor,
    secciones: row.secciones ?? [],
    creadaEl: fmtMonthYear(row.created_at),
  };
}

export async function listListasDifusion(): Promise<ListaDifusion[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("listas_difusion")
    .select(COLS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as ListaRow[]).map(toLista);
}

/** Alta si `id` viene vacío, edición si no. */
export async function saveListaDifusion(
  id: string,
  data: {
    nombre: string;
    mensajeInicial: string;
    mensajeFinal: string;
    descuentoTipo: ListaDifusion["descuentoTipo"];
    descuentoValor: number;
    secciones: DifusionSeccion[];
  },
): Promise<ListaDifusion> {
  const supabase = createServerClient();
  const patch = {
    nombre: data.nombre,
    mensaje_inicial: data.mensajeInicial || null,
    mensaje_final: data.mensajeFinal || null,
    descuento_tipo: data.descuentoTipo,
    descuento_valor: data.descuentoValor,
    secciones: data.secciones,
  };
  const query = id
    ? supabase.from("listas_difusion").update(patch).eq("id", id)
    : supabase.from("listas_difusion").insert(patch);
  const { data: row, error } = await query.select(COLS).single();
  if (error) throw error;
  return toLista(row as unknown as ListaRow);
}
