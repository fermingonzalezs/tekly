import { z } from "zod";
import {
  DATE_PRESETS,
  presetRange,
  type DatePreset,
  type Rango,
} from "@/lib/date-presets";
import type { Rubro } from "@/lib/ventas";

export type VistaVentas = "ventas" | "items";
export type SortVentas = "fecha" | "total_usd" | "numero" | "margen_pct";
export type Dir = "asc" | "desc";

const PRESETS = DATE_PRESETS.map((p) => p.value) as [DatePreset, ...DatePreset[]];
const SORTS: [SortVentas, ...SortVentas[]] = [
  "fecha",
  "total_usd",
  "numero",
  "margen_pct",
];
const RUBROS: [Rubro, ...Rubro[]] = ["equipo", "servicio", "otro", "libre"];

/** Filtros de la sección Ventas, con la URL como fuente de verdad. `vendedor`
 * y `tipo` (rubro) son `""` cuando no hay filtro. */
export type FiltrosVentas = {
  preset: DatePreset;
  desde: string;
  hasta: string;
  /** id de `profiles` (no el nombre -- ver plan 007). */
  vendedor: string;
  /** Rubro de los ítems (`categoriaDe`), no `Venta.tipo`. */
  tipo: Rubro | "";
  q: string;
  vista: VistaVentas;
  page: number;
  sort: SortVentas;
  dir: Dir;
};

export type SearchParamsInput = Record<string, string | string[] | undefined>;

const schema = z.object({
  preset: z.enum(PRESETS).catch("mes"),
  vista: z.enum(["ventas", "items"]).catch("ventas"),
  sort: z.enum(SORTS).catch("fecha"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().min(1).catch(1),
  tipo: z.enum(RUBROS).optional().catch(undefined),
  vendedor: z.string().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
});

function primero(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

/** Params crudos de `searchParams` de Next -> filtros validados. Cualquier
 * valor inválido cae al default (nunca rompe la página): página < 1 → 1,
 * `sort` fuera de la whitelist → `fecha`, etc. */
export function parseFiltrosVentas(
  params: SearchParamsInput,
  opts: { puedeVerCosto: boolean },
): FiltrosVentas {
  const raw = {
    preset: primero(params.preset),
    vista: primero(params.vista),
    sort: primero(params.sort),
    dir: primero(params.dir),
    page: primero(params.page),
    tipo: primero(params.tipo),
    vendedor: primero(params.vendedor),
    q: primero(params.q),
    desde: primero(params.desde),
    hasta: primero(params.hasta),
  };
  const parsed = schema.safeParse(raw);
  const data = parsed.success ? parsed.data : schema.parse({});

  // Un vendedor no puede ordenar por margen ni aunque lo pida por URL.
  const sort =
    data.sort === "margen_pct" && !opts.puedeVerCosto ? "fecha" : data.sort;

  return {
    preset: data.preset,
    desde: data.desde ?? "",
    hasta: data.hasta ?? "",
    vendedor: data.vendedor ?? "",
    tipo: data.tipo ?? "",
    q: (data.q ?? "").trim(),
    vista: data.vista,
    page: data.page,
    sort,
    dir: data.dir,
  };
}

/** Query string (sin el `?`) que representa los filtros. Solo escribe los
 * que difieren del default, así la URL compartible queda legible. */
export function queryDeFiltros(f: FiltrosVentas): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.preset !== "mes") p.set("preset", f.preset);
  if (f.preset === "personalizado") {
    if (f.desde) p.set("desde", f.desde);
    if (f.hasta) p.set("hasta", f.hasta);
  }
  if (f.vendedor) p.set("vendedor", f.vendedor);
  if (f.tipo) p.set("tipo", f.tipo);
  if (f.vista !== "ventas") p.set("vista", f.vista);
  if (f.page > 1) p.set("page", String(f.page));
  if (f.sort !== "fecha") p.set("sort", f.sort);
  if (f.dir !== "desc") p.set("dir", f.dir);
  return p.toString();
}

/** Hay algún filtro distinto del default (período `mes`, sin búsqueda,
 * vendedor ni tipo). Decide entre empty state "sin ventas" y "limpiar
 * filtros". */
export function hayFiltrosActivos(f: FiltrosVentas): boolean {
  return !!f.q || !!f.vendedor || !!f.tipo || f.preset !== "mes";
}

/** Rango `{ desde, hasta }` (ISO, en hora de Argentina) para un preset. Para
 * `personalizado` usa las fechas de la URL (puede quedar abierto). */
export function rangoDe(f: FiltrosVentas, now = new Date()): Rango {
  if (f.preset === "personalizado") return { desde: f.desde, hasta: f.hasta };
  return presetRange(f.preset, now) ?? { desde: "", hasta: "" };
}

/** Leyenda del delta de los KPIs según el período. */
export function deltaHintDe(preset: DatePreset): string {
  switch (preset) {
    case "mes":
      return "vs mismo tramo mes anterior";
    case "mes_anterior":
      return "vs mes anterior";
    case "15dias":
      return "vs 15 días previos";
    default:
      return "vs período previo";
  }
}
