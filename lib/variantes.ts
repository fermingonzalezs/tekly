import type { CelularStatus, Variante, VarianteCategoria } from "@/lib/types";

/** Los datos que definen una variante. Celulares: modelo, almacenamiento,
 * condición y color (vacío = cualquier color). Notebooks: modelo, memoria,
 * almacenamiento y condición (sin color). `categoria` ausente = celular. */
export type DatosVariante = {
  categoria?: VarianteCategoria;
  modelo: string;
  memoria?: string;
  almacenamiento: string;
  condicion: string;
  color: string;
};

/** Lo mínimo de una unidad (celular o notebook) para contar stock/precios. */
export type UnidadDeVariante = {
  id: string;
  varianteId: string;
  estado: CelularStatus;
  precioUsd: number;
};

/** Texto comparable: minúsculas, sin tildes, `trim` y espacios colapsados. */
export function normalizar(valor: string): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** «128 GB» y «128gb» son el mismo almacenamiento. */
export function normalizarAlmacenamiento(valor: string): string {
  return normalizar(valor).replace(/\s+/g, "");
}

/** Clave única de una variante dentro de la organización:
 * `modelo|almacenamiento|CONDICIÓN|color` (todo normalizado). La variante de
 * «cualquier color» lleva el color vacío, así que nunca choca con una
 * variante con color. */
export function claveVariante(datos: DatosVariante): string {
  if (datos.categoria === "notebook") {
    // `modelo|memoria|almacenamiento|CONDICIÓN` -- igual que `clave_notebook`
    // en la base.
    return [
      normalizar(datos.modelo),
      normalizarAlmacenamiento(datos.memoria ?? ""),
      normalizarAlmacenamiento(datos.almacenamiento),
      (datos.condicion ?? "").trim().toUpperCase(),
    ].join("|");
  }
  return [
    normalizar(datos.modelo),
    normalizarAlmacenamiento(datos.almacenamiento),
    (datos.condicion ?? "").trim().toUpperCase(),
    normalizar(datos.color),
  ].join("|");
}

/** Variante activa que corresponde a los datos de una unidad: primero busca
 * una con su mismo color y, si no hay, la de «cualquier color». */
export function buscarVariante<T extends Variante>(
  variantes: T[],
  datos: DatosVariante,
): T | undefined {
  const categoria = datos.categoria ?? "celular";
  const activas = variantes.filter((v) => v.activa && (v.categoria ?? "celular") === categoria);
  const conColor = claveVariante(datos);
  const exacta = activas.find((v) => claveVariante(v) === conColor);
  if (exacta) return exacta;
  const sinColor = claveVariante({ ...datos, color: "" });
  return activas.find((v) => claveVariante({ ...v, color: "" }) === sinColor);
}

/** Condición tal como va en el SKU: solo `NUEVO` o `USADO` (los grados
 * A+/A/B+/B/C son todos usados). Vacía si la condición no está cargada. */
export function condicionSku(condicion: string): "" | "NUEVO" | "USADO" {
  const c = (condicion ?? "").trim().toUpperCase();
  if (!c) return "";
  return c === "NUEVO" ? "NUEVO" : "USADO";
}

/** SKU legible sugerido: `IPHONE-15-PRO-128GB-USADO` (+ `-NEGRO` si la
 * variante tiene color); notebooks `MACBOOK-AIR-M2-16GB-512GB-USADO`. Si ya
 * existe, agrega `-2`, `-3`… */
export function skuSugerido(datos: DatosVariante, existentes: Iterable<string>): string {
  const esNotebook = datos.categoria === "notebook";
  const base =
    [
      normalizar(datos.modelo),
      esNotebook ? normalizarAlmacenamiento(datos.memoria ?? "") : "",
      normalizarAlmacenamiento(datos.almacenamiento),
      normalizar(condicionSku(datos.condicion)),
      esNotebook ? "" : normalizar(datos.color),
    ]
      .filter(Boolean)
      .join("-")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toUpperCase() || (esNotebook ? "NOTEBOOK" : "CELULAR");
  const usados = new Set(Array.from(existentes, (sku) => sku.trim().toUpperCase()));
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Campos clave que la variante copia a la unidad (y bloquea en el form).
 * `color` vacío = la unidad conserva el suyo. */
export function camposDesdeVariante(variante: Variante): DatosVariante {
  return {
    categoria: variante.categoria,
    modelo: variante.modelo,
    memoria: variante.memoria,
    almacenamiento: variante.almacenamiento,
    condicion: variante.condicion,
    color: variante.color,
  };
}

/** «iPhone 15 Pro · 128 GB · A · Negro». Con `cualquierColor` agrega
 * «· Cualquier color» cuando la variante no define color. Notebooks:
 * «MacBook Air M2 · 16 GB · 512 GB · Usado». */
export function nombreVariante(
  variante: Variante,
  { cualquierColor = false }: { cualquierColor?: boolean } = {},
): string {
  if (variante.categoria === "notebook") {
    return [
      variante.modelo,
      variante.memoria,
      variante.almacenamiento,
      condicionLabel(variante.condicion),
    ]
      .filter(Boolean)
      .join(" · ");
  }
  const partes = [variante.modelo, variante.almacenamiento, variante.condicion];
  if (variante.color) partes.push(variante.color);
  else if (cualquierColor) partes.push("Cualquier color");
  return partes.filter(Boolean).join(" · ");
}

/** «nuevo» → «Nuevo» (las condiciones de notebooks se guardan en minúscula;
 * los grados de celulares quedan igual). */
export function condicionLabel(condicion: string): string {
  const c = (condicion ?? "").trim();
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : "";
}

export type GrupoVariantes = {
  /** Nombre tal como lo cargó el usuario (el de la primera variante). */
  grupo: string;
  /** Clave normalizada para comparar/ordenar. */
  clave: string;
  variantes: Variante[];
};

/** Agrupa por el nombre del grupo normalizado -- dos variantes con el mismo
 * grupo y distinto modelo quedan juntas. El grupo vacío cae al modelo. */
export function agruparPorGrupo(variantes: Variante[]): GrupoVariantes[] {
  const porClave = new Map<string, Variante[]>();
  for (const variante of variantes) {
    const clave = normalizar(variante.grupo) || normalizar(variante.modelo);
    const lista = porClave.get(clave);
    if (lista) lista.push(variante);
    else porClave.set(clave, [variante]);
  }
  return Array.from(porClave.entries()).map(([clave, lista]) => ({
    grupo: lista[0].grupo || lista[0].modelo,
    clave,
    variantes: lista,
  }));
}

/** Grupos alfabéticos (sin distinguir mayúsculas ni tildes). */
export function ordenarGrupos(grupos: GrupoVariantes[]): GrupoVariantes[] {
  return [...grupos].sort((a, b) => a.grupo.localeCompare(b.grupo, "es", { sensitivity: "base" }));
}

/** Stock de una variante por estado. Lo vendido/extraviado no cuenta. */
export function stockDeVariante(
  variante: Variante,
  unidades: UnidadDeVariante[],
): { disponibles: number; reservadas: number; enRevision: number } {
  const mias = unidades.filter((u) => u.varianteId === variante.id);
  return {
    disponibles: mias.filter((u) => u.estado === "disponible").length,
    reservadas: mias.filter((u) => u.estado === "reservado").length,
    enRevision: mias.filter((u) => u.estado === "en_revision").length,
  };
}

/** Precio mínimo y máximo de las unidades no vendidas de la variante (o el de
 * la variante si todavía no tiene unidades). */
export function rangoPrecio(variante: Variante, unidades: UnidadDeVariante[]): [number, number] {
  const precios = unidades
    .filter(
      (u) =>
        u.varianteId === variante.id && u.estado !== "vendido" && u.estado !== "extraviado",
    )
    .map((u) => u.precioUsd);
  if (precios.length === 0) return [variante.precioUsd, variante.precioUsd];
  return [Math.min(...precios), Math.max(...precios)];
}

/** Precio más frecuente (backfill de variantes); empate → el mayor. */
export function precioModa(precios: number[]): number {
  if (precios.length === 0) return 0;
  const conteo = new Map<number, number>();
  for (const precio of precios) conteo.set(precio, (conteo.get(precio) ?? 0) + 1);
  let mejor = precios[0];
  let mejorConteo = 0;
  for (const [precio, cantidad] of conteo) {
    if (cantidad > mejorConteo || (cantidad === mejorConteo && precio > mejor)) {
      mejor = precio;
      mejorConteo = cantidad;
    }
  }
  return mejor;
}

/** Variantes activas con mínimo configurado y stock disponible por debajo. */
export function variantesBajoMinimo(variantes: Variante[], unidades: UnidadDeVariante[]): Variante[] {
  return variantes.filter(
    (v) => v.activa && v.stockMinimo > 0 && stockDeVariante(v, unidades).disponibles < v.stockMinimo,
  );
}

/** ¿La variante cruzó el mínimo hacia abajo con este cambio? Es lo que
 * dispara el evento `low_stock` (con `0` = sin mínimo, nunca avisa). */
export function cruzoMinimo(antes: number, despues: number, minimo: number): boolean {
  return minimo > 0 && antes >= minimo && despues < minimo;
}
