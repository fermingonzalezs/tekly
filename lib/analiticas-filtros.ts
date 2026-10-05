import { z } from "zod";
import {
  DATE_PRESETS,
  presetRange,
  type DatePreset,
  type Rango,
} from "@/lib/date-presets";

export type TabAnaliticas =
  | "ventas"
  | "reparaciones"
  | "finanzas"
  | "inventario"
  | "clientes"
  | "turnos";

export const TABS_ANALITICAS: { value: TabAnaliticas; label: string }[] = [
  { value: "ventas", label: "Ventas" },
  { value: "reparaciones", label: "Reparaciones" },
  { value: "finanzas", label: "Finanzas" },
  { value: "inventario", label: "Inventario" },
  { value: "clientes", label: "Clientes" },
  { value: "turnos", label: "Turnos" },
];

const TAB_VALUES = TABS_ANALITICAS.map((t) => t.value) as [
  TabAnaliticas,
  ...TabAnaliticas[],
];
const PRESETS = DATE_PRESETS.map((p) => p.value) as [DatePreset, ...DatePreset[]];

export type FiltrosAnaliticas = {
  tab: TabAnaliticas;
  preset: DatePreset;
  desde: string;
  hasta: string;
};

export type SearchParamsInput = Record<string, string | string[] | undefined>;

const schema = z.object({
  tab: z.enum(TAB_VALUES).catch("ventas"),
  preset: z.enum(PRESETS).catch("mes"),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
});

function primero(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

/** Params crudos de `searchParams` de Next -> filtros validados. Valores
 * inválidos caen al default; un rango personalizado sin fechas queda como
 * rango abierto (sigue siendo "personalizado"); `desde > hasta` se
 * intercambian. */
export function parseFiltrosAnaliticas(
  params: SearchParamsInput,
): FiltrosAnaliticas {
  const parsed = schema.safeParse({
    tab: primero(params.tab),
    preset: primero(params.preset),
    desde: primero(params.desde),
    hasta: primero(params.hasta),
  });
  const data = parsed.success ? parsed.data : schema.parse({});

  const preset = data.preset;
  let desde = data.desde ?? "";
  let hasta = data.hasta ?? "";

  // "personalizado" sin fechas NO cae a "mes": es el estado en que queda el
  // selector justo después de elegir esa opción (todavía sin fechas) y tiene
  // que seguir siendo "personalizado" para que aparezcan los campos de fecha.
  // Sin fechas = rango abierto (toda la historia), igual que en Ventas. Una
  // fecha con formato inválido ya se descartó arriba (queda vacía).
  if (preset === "personalizado" && desde && hasta && desde > hasta) {
    [desde, hasta] = [hasta, desde];
  }

  return { tab: data.tab, preset, desde, hasta };
}

/** Query string (sin `?`) de los filtros. Solo escribe lo no-default. */
export function queryDeAnaliticas(f: FiltrosAnaliticas): string {
  const p = new URLSearchParams();
  if (f.tab !== "ventas") p.set("tab", f.tab);
  if (f.preset !== "mes") p.set("preset", f.preset);
  if (f.preset === "personalizado") {
    if (f.desde) p.set("desde", f.desde);
    if (f.hasta) p.set("hasta", f.hasta);
  }
  return p.toString();
}

/** Rango `{ desde, hasta }` (ISO, hora argentina) del preset; `personalizado`
 * usa las fechas de la URL. */
export function rangoDe(f: FiltrosAnaliticas, now = new Date()): Rango {
  if (f.preset === "personalizado") return { desde: f.desde, hasta: f.hasta };
  return presetRange(f.preset, now) ?? { desde: "", hasta: "" };
}
