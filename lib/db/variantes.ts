import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { requireUser } from "@/lib/auth";
import { claveVariante, normalizar } from "@/lib/variantes";
import type { Variante, VarianteCategoria } from "@/lib/types";

type VarianteRow = {
  id: string;
  categoria: VarianteCategoria;
  grupo: string;
  sku: string;
  modelo: string;
  almacenamiento: string;
  condicion: string;
  color: string;
  memoria: string;
  pantalla: string;
  precio_usd: number;
  precio_mayorista_usd: number | string | null;
  stock_minimo: number;
  activa: boolean;
};

const VARIANTE_COLS =
  "id, categoria, grupo, sku, modelo, almacenamiento, condicion, color, memoria, pantalla, precio_usd, precio_mayorista_usd, stock_minimo, activa";

/** Tabla de las unidades de cada categoría (y su `item_type` en
 * `movimientos_stock`, que coincide con la categoría). */
function tablaUnidades(categoria: VarianteCategoria): "celulares" | "notebooks" {
  return categoria === "notebook" ? "notebooks" : "celulares";
}

/** Datos clave que la variante copia a sus unidades. En celulares el color
 * solo si la variante lo define; en notebooks también la memoria y la
 * pantalla (si la variante la define). */
function camposParaUnidades(v: Variante): Record<string, unknown> {
  const cambios: Record<string, unknown> = {
    modelo: v.modelo,
    almacenamiento: v.almacenamiento || null,
  };
  if (v.categoria === "notebook") {
    cambios.memoria = v.memoria || null;
    cambios.condicion = v.condicion;
    if (v.pantalla) cambios.pantalla = v.pantalla;
  } else {
    cambios.condicion = v.condicion || null;
    if (v.color) cambios.color = v.color;
  }
  return cambios;
}

function toVariante(row: VarianteRow): Variante {
  return {
    id: row.id,
    categoria: row.categoria ?? "celular",
    grupo: row.grupo,
    sku: row.sku,
    modelo: row.modelo,
    almacenamiento: row.almacenamiento ?? "",
    condicion: row.condicion ?? "",
    color: row.color ?? "",
    memoria: row.memoria ?? "",
    pantalla: row.pantalla ?? "",
    precioUsd: row.precio_usd,
    precioMayoristaUsd:
      row.precio_mayorista_usd === null ? null : Number(row.precio_mayorista_usd),
    stockMinimo: row.stock_minimo,
    activa: row.activa,
  };
}

export type VarianteInput = {
  /** Default `"celular"`. No se puede cambiar al editar. */
  categoria?: VarianteCategoria;
  grupo: string;
  sku: string;
  modelo: string;
  almacenamiento: string;
  condicion: string;
  color: string;
  /** Solo notebooks. */
  memoria?: string;
  /** Solo notebooks: tamaño de pantalla. */
  pantalla?: string;
  precioUsd: number;
  /** Opcional; `null`/omitido = sin precio mayorista. */
  precioMayoristaUsd?: number | null;
  stockMinimo: number;
};

/** Variantes de la organización. Por defecto solo las activas (el selector
 * no lista las desactivadas; la vista agrupada las pide con
 * `incluirInactivas`) y solo las de celulares (`categoria: "todas"` trae las
 * de todas las categorías). */
export async function listVariantes({
  incluirInactivas = false,
  categoria = "celular",
}: { incluirInactivas?: boolean; categoria?: VarianteCategoria | "todas" } = {}): Promise<
  Variante[]
> {
  const supabase = createServerClient();
  let query = supabase.from("variantes").select(VARIANTE_COLS);
  if (categoria !== "todas") query = query.eq("categoria", categoria);
  if (!incluirInactivas) query = query.eq("activa", true);
  const { data, error } = await query.order("grupo").order("sku");
  if (error) throw error;
  return (data as VarianteRow[]).map(toVariante);
}

export async function getVariante(id: string): Promise<Variante | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("variantes")
    .select(VARIANTE_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toVariante(data as VarianteRow) : null;
}

/** SKUs ya usados (cualquier estado) -- para `skuSugerido`. */
export async function listSkusExistentes(): Promise<string[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("variantes").select("sku");
  if (error) throw error;
  return data.map((r) => r.sku as string);
}

/** Variante de la unidad, reactivándola si estaba desactivada. Es el único
 * punto por donde pasan las altas de celulares/notebooks: los campos clave
 * que mande el cliente **no** se usan, se copian de acá. */
export async function varianteParaUnidad(
  id: string,
  categoria: VarianteCategoria = "celular",
): Promise<Variante> {
  if (!id) throw new Error("Elegí una variante.");
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("variantes")
    .select(VARIANTE_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("La variante elegida no existe.");
  if ((data as VarianteRow).categoria !== categoria) {
    throw new Error("La variante elegida no corresponde a este tipo de equipo.");
  }
  if (!(data as VarianteRow).activa) {
    const { data: reactivada, error: updateError } = await supabase
      .from("variantes")
      .update({ activa: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(VARIANTE_COLS)
      .single();
    if (updateError) throw updateError;
    return toVariante(reactivada as VarianteRow);
  }
  return toVariante(data as VarianteRow);
}

/** Igual que `varianteParaUnidad` pero en lote (importación): una sola
 * lectura + una sola reactivación. Devuelve id → variante. */
export async function variantesParaUnidades(
  ids: string[],
  categoria: VarianteCategoria = "celular",
): Promise<Map<string, Variante>> {
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  if (unicos.length === 0) return new Map();
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("variantes")
    .select(VARIANTE_COLS)
    .in("id", unicos)
    .eq("categoria", categoria);
  if (error) throw error;
  const filas = data as VarianteRow[];
  const inactivas = filas.filter((f) => !f.activa).map((f) => f.id);
  if (inactivas.length > 0) {
    const { error: updateError } = await supabase
      .from("variantes")
      .update({ activa: true, updated_at: new Date().toISOString() })
      .in("id", inactivas);
    if (updateError) throw updateError;
  }
  return new Map(
    filas.map((f) => [f.id, toVariante({ ...f, activa: true })]),
  );
}

/** Alta de variante. Si ya existe una **desactivada** con la misma clave, la
 * reactiva (no duplica); si existe activa, error. El SKU es obligatorio y
 * único por organización. */
export async function createVariante(input: VarianteInput): Promise<Variante> {
  const supabase = createServerClient();
  const sku = input.sku.trim().toUpperCase();
  if (!sku) throw new Error("El SKU es obligatorio.");
  const categoria = input.categoria ?? "celular";
  const datos = datosDeInput(input, categoria);
  validarDatos(datos);
  const clave = claveVariante(datos);

  const { data: existente } = await supabase
    .from("variantes")
    .select(VARIANTE_COLS)
    .eq("categoria", categoria)
    .eq("clave", clave)
    .maybeSingle();

  if (existente) {
    const variante = existente as VarianteRow;
    if (variante.activa) {
      throw new Error(`Ya existe la variante ${variante.sku} con esos datos.`);
    }
    const { data: reactivada, error } = await supabase
      .from("variantes")
      .update({
        activa: true,
        grupo: input.grupo.trim() || variante.grupo,
        precio_usd: input.precioUsd,
        precio_mayorista_usd: input.precioMayoristaUsd ?? null,
        stock_minimo: input.stockMinimo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", variante.id)
      .select(VARIANTE_COLS)
      .single();
    if (error) throw error;
    return toVariante(reactivada as VarianteRow);
  }

  const { data, error } = await supabase
    .from("variantes")
    .insert({
      categoria,
      grupo: input.grupo.trim(),
      sku,
      modelo: datos.modelo,
      almacenamiento: datos.almacenamiento,
      condicion: datos.condicion,
      color: datos.color,
      memoria: datos.memoria ?? "",
      pantalla: datos.pantalla ?? "",
      clave,
      precio_usd: input.precioUsd,
      precio_mayorista_usd: input.precioMayoristaUsd ?? null,
      stock_minimo: input.stockMinimo,
    })
    .select(VARIANTE_COLS)
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error(`El SKU ${sku} ya existe.`);
    }
    throw error;
  }
  return toVariante(data as VarianteRow);
}

/** Edita la variante. Si cambian los datos clave, se copian a sus unidades
 * **no vendidas**; si cambia el precio, se actualiza el de las unidades con
 * `precio_propio = false` (no vendidas). Cada unidad tocada deja su
 * movimiento de stock. */
export async function updateVariante(id: string, input: VarianteInput): Promise<Variante> {
  const supabase = createServerClient();
  const actual = await getVariante(id);
  if (!actual) throw new Error("La variante no existe.");
  const sku = input.sku.trim().toUpperCase();
  if (!sku) throw new Error("El SKU es obligatorio.");
  const datos = datosDeInput(input, actual.categoria);
  validarDatos(datos);

  const claveNueva = claveVariante(datos);
  if (claveNueva !== claveVariante(actual)) {
    const { data: otra } = await supabase
      .from("variantes")
      .select("id, sku")
      .eq("categoria", actual.categoria)
      .eq("clave", claveNueva)
      .neq("id", id)
      .maybeSingle();
    if (otra) {
      throw new Error(`Ya existe la variante ${otra.sku} con esos datos: usá Unir.`);
    }
  }

  const { data, error } = await supabase
    .from("variantes")
    .update({
      grupo: input.grupo.trim(),
      sku,
      modelo: datos.modelo,
      almacenamiento: datos.almacenamiento,
      condicion: datos.condicion,
      color: datos.color,
      memoria: datos.memoria ?? "",
      pantalla: datos.pantalla ?? "",
      clave: claveNueva,
      precio_usd: input.precioUsd,
      precio_mayorista_usd: input.precioMayoristaUsd ?? null,
      stock_minimo: input.stockMinimo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(VARIANTE_COLS)
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error(`El SKU ${sku} ya existe.`);
    }
    throw error;
  }
  const variante = toVariante(data as VarianteRow);

  const tabla = tablaUnidades(variante.categoria);
  const { data: unidades, error: unidadesError } = await supabase
    .from(tabla)
    .select("id")
    .eq("variante_id", id)
    .neq("estado", "vendido");
  if (unidadesError) throw unidadesError;

  if (unidades && unidades.length > 0) {
    const camposCambiaron = claveVariante(actual) !== claveVariante(variante);
    const precioCambio = actual.precioUsd !== variante.precioUsd;

    if (camposCambiaron) {
      const { error: propError } = await supabase
        .from(tabla)
        .update(camposParaUnidades(variante))
        .eq("variante_id", id)
        .neq("estado", "vendido");
      if (propError) throw propError;
    }

    if (precioCambio) {
      const { error: precioError } = await supabase
        .from(tabla)
        .update({ precio_usd: variante.precioUsd })
        .eq("variante_id", id)
        .eq("precio_propio", false)
        .neq("estado", "vendido");
      if (precioError) throw precioError;
    }

    if (camposCambiaron || precioCambio) {
      await registrarMovimientos(
        variante.categoria,
        unidades.map((u) => u.id as string),
        `Variante ${variante.sku}: datos actualizados`,
        "edicion",
      );
    }
  }

  return variante;
}

/** Renombra el grupo en todas las variantes que lo comparten (comparando el
 * nombre normalizado). No toca modelo ni datos clave. */
export async function renombrarGrupo(
  grupoActual: string,
  nuevo: string,
  categoria: VarianteCategoria = "celular",
): Promise<number> {
  const supabase = createServerClient();
  const limpio = nuevo.trim();
  if (!limpio) throw new Error("El nombre del grupo no puede quedar vacío.");
  const variantes = await listVariantes({ incluirInactivas: true, categoria });
  const destino = normalizar(grupoActual);
  const ids = variantes.filter((v) => normalizar(v.grupo) === destino).map((v) => v.id);
  if (ids.length === 0) return 0;
  const { error } = await supabase
    .from("variantes")
    .update({ grupo: limpio, updated_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
  return ids.length;
}

/** Datos clave normalizados de un input, según la categoría: las notebooks no
 * tienen color (pero sí pantalla) y su condición se guarda en minúscula (`nuevo`/`usado`); los
 * celulares no tienen memoria. */
function datosDeInput(input: VarianteInput, categoria: VarianteCategoria) {
  const esNotebook = categoria === "notebook";
  return {
    categoria,
    modelo: input.modelo.trim(),
    almacenamiento: input.almacenamiento.trim(),
    condicion: esNotebook ? input.condicion.trim().toLowerCase() : input.condicion.trim(),
    color: esNotebook ? "" : input.color.trim(),
    memoria: esNotebook ? (input.memoria ?? "").trim() : "",
    pantalla: esNotebook ? (input.pantalla ?? "").trim() : "",
  };
}

/** Las variantes de notebooks llevan el tamaño de pantalla. */
function validarDatos(datos: ReturnType<typeof datosDeInput>) {
  if (datos.categoria === "notebook" && !datos.pantalla) {
    throw new Error("Cargá el tamaño de pantalla de la variante.");
  }
}

function claveGrupoDe(grupo: string): string {
  return grupo.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function setVarianteActiva(id: string, activa: boolean): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("variantes")
    .update({ activa, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Solo si **ninguna** unidad (de cualquier estado) la referencia. */
export async function deleteVariante(id: string): Promise<void> {
  const supabase = createServerClient();
  const variante = await getVariante(id);
  if (!variante) return;
  const { count, error: countError } = await supabase
    .from(tablaUnidades(variante.categoria))
    .select("id", { count: "exact", head: true })
    .eq("variante_id", id);
  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    throw new Error("La variante tiene equipos: desactivala en vez de eliminarla.");
  }
  const { error } = await supabase.from("variantes").delete().eq("id", id);
  if (error) throw error;
}

/** Mueve todas las unidades de `origen` a `destino`, copiándoles los datos
 * clave (y el precio de destino si la unidad no tiene precio propio), y
 * elimina la variante de origen. */
export async function unirVariantes(origenId: string, destinoId: string): Promise<void> {
  if (origenId === destinoId) return;
  const supabase = createServerClient();
  const [origen, destino] = await Promise.all([getVariante(origenId), getVariante(destinoId)]);
  if (!origen || !destino) throw new Error("Alguna de las variantes no existe.");
  if (origen.categoria !== destino.categoria) {
    throw new Error("Solo se pueden unir variantes del mismo tipo de equipo.");
  }
  const tabla = tablaUnidades(destino.categoria);

  if (!destino.activa) {
    const { error: activarError } = await supabase
      .from("variantes")
      .update({ activa: true, updated_at: new Date().toISOString() })
      .eq("id", destinoId);
    if (activarError) throw activarError;
  }

  const { data: unidades, error } = await supabase
    .from(tabla)
    .select("id")
    .eq("variante_id", origenId);
  if (error) throw error;

  if (unidades && unidades.length > 0) {
    const { error: moveError } = await supabase
      .from(tabla)
      .update({ ...camposParaUnidades(destino), variante_id: destinoId })
      .eq("variante_id", origenId);
    if (moveError) throw moveError;

    const { error: precioError } = await supabase
      .from(tabla)
      .update({ precio_usd: destino.precioUsd })
      .eq("variante_id", destinoId)
      .eq("precio_propio", false)
      .neq("estado", "vendido");
    if (precioError) throw precioError;

    await registrarMovimientos(
      destino.categoria,
      unidades.map((u) => u.id as string),
      `Variante ${origen.sku} → ${destino.sku}: unión`,
      "edicion",
    );
  }

  const { error: deleteError } = await supabase.from("variantes").delete().eq("id", origenId);
  if (deleteError) throw deleteError;
}

/** Un solo insert de movimientos para N unidades (mismo usuario). */
async function registrarMovimientos(
  categoria: VarianteCategoria,
  ids: string[],
  detalle: string,
  tipo: "edicion" | "ingreso",
): Promise<void> {
  if (ids.length === 0) return;
  const user = await requireUser();
  const supabase = createServerClient();
  const { error } = await supabase.from("movimientos_stock").insert(
    ids.map((id) => ({
      item_type: categoria,
      item_id: id,
      detalle,
      tipo,
      usuario_id: user.id,
      usuario_nombre: user.nombre,
    })),
  );
  if (error) throw error;
}
