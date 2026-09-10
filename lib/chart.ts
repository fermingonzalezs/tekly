// Paleta única de todos los gráficos de la app (dashboard, analíticas, …).
// Monocromática índigo: mayor valor = tono más oscuro. Mismo índice ⇒ mismo
// color en cualquier card.
export const CHART_COLORS = [
  "#2e2a5f",
  "#352f86",
  "#4f49bd",
  "#7269d4",
  "#948dde",
] as const;

export const chartColor = (i: number) =>
  CHART_COLORS[i % CHART_COLORS.length];

// Índigo fuerte para líneas y rellenos con presencia (tendencia, objetivo).
export const CHART_ACCENT = "#4f49bd";

// Gráficos con categorías fijas: siempre el mismo tono por clave.
export const TURNO_TIPO_COLOR = {
  compra: CHART_COLORS[3],
  deja: CHART_COLORS[0],
  retira: CHART_COLORS[1],
  cotizar: CHART_COLORS[2],
} as const;

// Pista / fondo neutro de arcos y barras "fantasma".
export const CHART_TRACK = "#e9e8f9"; // = accent-soft (índigo claro)

// Relleno rayado diagonal: barra en reposo / tramo no cumplido de un objetivo.
export const GHOST_STRIPES =
  "repeating-linear-gradient(45deg, #d4d4d8 0 4px, #ededf0 4px 8px)";

// Rampa secuencial para heatmaps: claro → oscuro (mismo hue índigo).
export const HEAT_SCALE = [
  "#e9e8f9",
  "#948dde",
  "#7269d4",
  "#4f49bd",
  "#352f86",
  "#2e2a5f",
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
