// Paleta única de todos los gráficos de la app (dashboard, analíticas, …).
// Monocromática: mayor valor = tono más oscuro. Mismo índice ⇒ mismo color
// en cualquier card. Los valores son CSS vars (--chart-*, --accent-soft) que
// define el tema activo (app/globals.css) -- los charts siguen la paleta de
// la organización sin tocar acá. Como strings se usan igual en style={{...}}
// y en atributos SVG.
export const CHART_COLORS = [
  "var(--chart-0)",
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
] as const;

export const chartColor = (i: number) =>
  CHART_COLORS[i % CHART_COLORS.length];

// Tono fuerte de la paleta para líneas y rellenos con presencia (tendencia,
// objetivo).
export const CHART_ACCENT = "var(--chart-2)";

// Gráficos con categorías fijas: siempre el mismo tono por clave.
export const TURNO_TIPO_COLOR = {
  compra: CHART_COLORS[3],
  deja: CHART_COLORS[0],
  retira: CHART_COLORS[1],
  cotizar: CHART_COLORS[2],
} as const;

// Pista / fondo neutro de arcos y barras "fantasma".
export const CHART_TRACK = "var(--accent-soft)";

// Relleno rayado diagonal: barra en reposo / tramo no cumplido de un objetivo.
// Gris fijo a propósito: es "tramo no cumplido", no color de marca.
export const GHOST_STRIPES =
  "repeating-linear-gradient(45deg, #d4d4d8 0 4px, #ededf0 4px 8px)";

// Rampa secuencial para heatmaps: claro → oscuro (mismo hue de la paleta).
export const HEAT_SCALE = [
  "var(--accent-soft)",
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-1)",
  "var(--chart-0)",
] as const;

// Aliases: el dashboard estrenó estos nombres; ahora son la paleta de toda
// la app. Se mantienen para no tocar los imports existentes.
export const DASH_COLORS = CHART_COLORS;
export const dashColor = chartColor;
export const DASH_ACCENT = CHART_ACCENT;
export const DASH_HEAT = HEAT_SCALE;

/** Devuelve `{ bg, dark }` para un valor `v` dentro de `[min, max]`.
 *  `dark` = true si el texto encima debería ser oscuro (celda clara). */
export function heatCell(
  v: number,
  min: number,
  max: number,
  scale: readonly string[] = HEAT_SCALE,
) {
  const t = max > min ? (v - min) / (max - min) : 0;
  const i = Math.round(t * (scale.length - 1));
  return { bg: scale[i], dark: i <= 2 };
}
