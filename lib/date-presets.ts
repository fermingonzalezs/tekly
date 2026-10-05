export type DatePreset = "todos" | "mes" | "mes_anterior" | "15dias" | "personalizado";

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "todos", label: "Todas las fechas" },
  { value: "mes", label: "Este mes" },
  { value: "mes_anterior", label: "Mes anterior" },
  { value: "15dias", label: "Últimos 15 días" },
  { value: "personalizado", label: "Rango personalizado" },
];

export type Rango = { desde: string; hasta: string };

const TZ = "America/Argentina/Buenos_Aires";

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "Hoy" como `YYYY-MM-DD` en hora de Argentina. `toISOString()` devuelve la
 * fecha en UTC: después de las 21 h argentinas ya es "mañana", y un
 * "Este mes" calculado con eso incluye o excluye un día de más. El server
 * (UTC) y el navegador (ART) tienen que coincidir, así que todo el cálculo
 * de rangos parte de esta función. */
export function hoyISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// ── Aritmética de calendario sobre strings ISO (sin huso horario) ──

function parse(iso: string): { y: number; m0: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m0: m - 1, d };
}

function fmt(y: number, m0: number, d: number): string {
  return new Date(Date.UTC(y, m0, d)).toISOString().slice(0, 10);
}

/** Suma (o resta) días a una fecha ISO. */
export function sumarDias(iso: string, dias: number): string {
  const { y, m0, d } = parse(iso);
  return fmt(y, m0, d + dias);
}

/** Días entre dos fechas ISO (`b - a`). */
export function diasEntre(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  return Math.round(
    (Date.UTC(pb.y, pb.m0, pb.d) - Date.UTC(pa.y, pa.m0, pa.d)) / 86_400_000,
  );
}

function diasDelMes(y: number, m0: number): number {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

/** Rango `{ desde, hasta }` (ISO) para un preset, o `null` para "todos" /
 * "personalizado" (ese último usa las fechas que eligió el usuario). */
export function presetRange(preset: DatePreset, now = new Date()): Rango | null {
  const hoy = hoyISO(now);
  const { y, m0 } = parse(hoy);
  if (preset === "mes") {
    return { desde: fmt(y, m0, 1), hasta: hoy };
  }
  if (preset === "mes_anterior") {
    return { desde: fmt(y, m0 - 1, 1), hasta: fmt(y, m0, 0) };
  }
  if (preset === "15dias") {
    return { desde: sumarDias(hoy, -15), hasta: hoy };
  }
  return null;
}

/** Período inmediatamente anterior y comparable, para los deltas de los
 * KPIs. `null` si no hay contra qué comparar ("todos", o un rango abierto).
 * - "Este mes" (a la fecha) → el mismo tramo del mes anterior (del 1 al
 *   mismo día del mes; si el mes anterior es más corto, hasta su último día).
 * - "Mes anterior" → el mes de antes, completo.
 * - Cualquier otro rango → los mismos N días inmediatamente previos. */
export function periodoAnterior(preset: DatePreset, rango: Rango): Rango | null {
  if (preset === "todos" || !rango.desde || !rango.hasta) return null;

  if (preset === "mes") {
    const { y, m0 } = parse(rango.desde);
    const dia = parse(rango.hasta).d;
    return {
      desde: fmt(y, m0 - 1, 1),
      hasta: fmt(y, m0 - 1, Math.min(dia, diasDelMes(y, m0 - 1))),
    };
  }
  if (preset === "mes_anterior") {
    const { y, m0 } = parse(rango.desde);
    return { desde: fmt(y, m0 - 1, 1), hasta: fmt(y, m0, 0) };
  }
  const largo = diasEntre(rango.desde, rango.hasta) + 1;
  const hasta = sumarDias(rango.desde, -1);
  return { desde: sumarDias(hasta, -(largo - 1)), hasta };
}

/** Texto de contexto bajo el selector de período: "Octubre 2026 · del 1 al
 * 4". Para rangos que cruzan de mes, "del 28 sep al 4 oct". */
export function contextoPeriodo(preset: DatePreset, rango: Rango): string {
  if (!rango.desde || !rango.hasta) return "Toda la historia";
  const d = parse(rango.desde);
  const h = parse(rango.hasta);
  const corto = (p: { m0: number; d: number }) =>
    `${p.d} ${MESES_LARGOS[p.m0].slice(0, 3)}`;
  const mismoMes = d.y === h.y && d.m0 === h.m0;
  if (mismoMes) {
    const mes = MESES_LARGOS[d.m0];
    const etiqueta = `${mes[0].toUpperCase()}${mes.slice(1)} ${d.y}`;
    return preset === "mes" || preset === "mes_anterior"
      ? `${etiqueta} · del ${d.d} al ${h.d}`
      : `del ${d.d} al ${h.d} de ${mes} ${d.y}`;
  }
  return `del ${corto(d)} al ${corto(h)} de ${h.y}`;
}

/** `iso` cae dentro del rango; un lado vacío es abierto. */
export function enRango(iso: string, rango: Rango): boolean {
  const dia = iso.slice(0, 10);
  return (!rango.desde || dia >= rango.desde) && (!rango.hasta || dia <= rango.hasta);
}
