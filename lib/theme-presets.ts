// Paletas de color por organización (Configuración → Datos del negocio).
// 7 presets curados -- no hay selector de color libre. `indigo` es
// exactamente la paleta original de la app (no cambia ni un hex) y es el
// default: organizaciones sin elección y páginas pre-login quedan igual
// que siempre.
//
// Mismo shape para todas: 5 pasos de gráfico (oscuro → claro) + 1 fondo
// suave. `chart[1]` es el fondo del header de tabla y de dialogs `accent`
// (contraste con texto blanco verificado ≥ 4.5:1, WCAG AA, en las 7) y
// `chart[2]` es el accent (color de marca/interacción). Los `*Rgb` son los
// triplets "R G B" para el truco de opacidad de Tailwind (ver
// tailwind.config.ts). Este archivo es la única fuente de los hex: el
// resto de la app usa las CSS vars de app/globals.css.

export type PaletaId = "indigo" | "azul" | "verde" | "violeta" | "rosa" | "naranja" | "negro";

export type Paleta = {
  id: PaletaId;
  label: string;
  /** Oscuro → claro. */
  chart: [string, string, string, string, string];
  accentSoft: string;
  /** "R G B" del accent (chart[2]). */
  accentRgb: string;
  /** "R G B" del accentSoft. */
  accentSoftRgb: string;
};

export const PALETAS: Paleta[] = [
  {
    id: "indigo",
    label: "Índigo",
    chart: ["#2e2a5f", "#352f86", "#4f49bd", "#7269d4", "#948dde"],
    accentSoft: "#edecf8",
    accentRgb: "79 73 189",
    accentSoftRgb: "237 236 248",
  },
  {
    id: "azul",
    label: "Azul",
    chart: ["#1a4370", "#225993", "#357fd0", "#629cda", "#89b5e3"],
    accentSoft: "#edf2f8",
    accentRgb: "53 127 208",
    accentSoftRgb: "237 242 248",
  },
  {
    id: "verde",
    label: "Verde",
    chart: ["#266447", "#32835d", "#4aba86", "#72caa1", "#96d7b9"],
    accentSoft: "#edf8f3",
    accentRgb: "74 186 134",
    accentSoftRgb: "237 248 243",
  },
  {
    id: "violeta",
    label: "Violeta",
    chart: ["#472267", "#5e2d88", "#8644c1", "#a16ecf", "#b992db"],
    accentSoft: "#f3edf8",
    accentRgb: "134 68 193",
    accentSoftRgb: "243 237 248",
  },
  {
    id: "rosa",
    label: "Rosa",
    chart: ["#6d1d41", "#8f2655", "#cb3a7b", "#d66698", "#e08cb2"],
    accentSoft: "#f8edf2",
    accentRgb: "203 58 123",
    accentSoftRgb: "248 237 242",
  },
  {
    id: "naranja",
    label: "Naranja",
    chart: ["#744216", "#98561d", "#d77c2d", "#e09a5c", "#e8b385"],
    accentSoft: "#f8f2ed",
    accentRgb: "215 124 45",
    accentSoftRgb: "248 242 237",
  },
  {
    id: "negro",
    label: "Negro",
    chart: ["#09090b", "#18181b", "#3f3f46", "#71717a", "#a1a1aa"],
    accentSoft: "#f4f4f5",
    accentRgb: "63 63 70",
    accentSoftRgb: "244 244 245",
  },
];

/** Id desconocido (o valor viejo en la base) → default índigo. */
export function paletaById(id: string): Paleta {
  return PALETAS.find((p) => p.id === id) ?? PALETAS[0];
}
