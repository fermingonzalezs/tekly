/** Historial del patrimonio (plan 019, fase 2). Lógica **pura**: arma la
 *  serie mensual y la variación contra el mes anterior a partir de las fotos
 *  diarias (`patrimonio_snapshots`). Sin Supabase ni `window`. No inventa
 *  datos: un mes sin ninguna foto simplemente no tiene punto. */

export type SnapshotPatrimonio = {
  /** `YYYY-MM-DD` (hora de Argentina). */
  fecha: string;
  cotizacion: number;
  activoUsd: number;
  pasivoUsd: number;
  patrimonioUsd: number;
};

export type PuntoMensual = {
  /** `YYYY-MM`. */
  clave: string;
  /** "oct 2026". */
  label: string;
  /** Fecha de la foto que representa al mes (la última de ese mes). */
  fecha: string;
  activoUsd: number;
  pasivoUsd: number;
  patrimonioUsd: number;
  /** El mes todavía no cerró: la foto es la de hoy, no la del último día. */
  enCurso: boolean;
};

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export function etiquetaMes(clave: string): string {
  return `${MESES[Number(clave.slice(5, 7)) - 1] ?? clave.slice(5, 7)} ${clave.slice(0, 4)}`;
}

/** Clave `YYYY-MM` del mes anterior a `clave`. */
export function mesPrevio(clave: string): string {
  const y = Number(clave.slice(0, 4));
  const m = Number(clave.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Última foto de cada mes, ascendente, topeada a los últimos `meses` meses
 *  (contando el en curso). `hoy` = `YYYY-MM-DD`. */
export function serieMensual(
  snapshots: SnapshotPatrimonio[],
  hoy: string,
  meses = 12,
): PuntoMensual[] {
  const porMes = new Map<string, SnapshotPatrimonio>();
  for (const s of [...snapshots].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    porMes.set(s.fecha.slice(0, 7), s); // la última del mes pisa a las anteriores
  }
  const mesActual = hoy.slice(0, 7);
  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-meses)
    .map(([clave, s]) => ({
      clave,
      label: etiquetaMes(clave),
      fecha: s.fecha,
      activoUsd: s.activoUsd,
      pasivoUsd: s.pasivoUsd,
      patrimonioUsd: s.patrimonioUsd,
      enCurso: clave === mesActual,
    }));
}

export type VariacionPatrimonio = {
  /** Mes contra el que se compara ("sep 2026"). */
  contraMes: string;
  patrimonio: number | null;
  activo: number | null;
  pasivo: number | null;
};

function pct(actual: number, previo: number): number | null {
  // Sin base (0) o con signo cambiado no hay un % con sentido.
  if (!(previo > 0) || !Number.isFinite(actual)) return null;
  return Math.round(((actual - previo) / previo) * 1000) / 10;
}

/** Variación % de hoy contra la **última foto del mes anterior** (el cierre
 *  de ese mes). `null` si todavía no hay foto de ese mes: el historial recién
 *  empieza. */
export function variacionVsMesAnterior(
  snapshots: SnapshotPatrimonio[],
  actual: { activoUsd: number; pasivoUsd: number; patrimonioUsd: number },
  hoy: string,
): VariacionPatrimonio | null {
  const previo = mesPrevio(hoy.slice(0, 7));
  const delMes = snapshots
    .filter((s) => s.fecha.slice(0, 7) === previo)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const cierre = delMes[delMes.length - 1];
  if (!cierre) return null;
  return {
    contraMes: etiquetaMes(previo),
    patrimonio: pct(actual.patrimonioUsd, cierre.patrimonioUsd),
    activo: pct(actual.activoUsd, cierre.activoUsd),
    pasivo: pct(actual.pasivoUsd, cierre.pasivoUsd),
  };
}

/** Primera fecha con foto (para el aviso «Historial desde dd/mm»). */
export function primeraFoto(snapshots: SnapshotPatrimonio[]): string | null {
  if (snapshots.length === 0) return null;
  return snapshots.map((s) => s.fecha).sort()[0];
}
