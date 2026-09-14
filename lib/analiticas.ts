import type { Venta } from "@/lib/types";

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function claveDia(y: number, m0: number, d: number): string {
  return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Facturación real por mes, últimos `meses` meses (incluye el actual).
 * Meses sin ventas salen en 0 -- no se saltean, para que el gráfico de
 * barras siempre tenga el mismo ancho.
 *
 * `fechaISO` es siempre "YYYY-MM-DD": lo leemos con slice, nunca con
 * `new Date(iso)` -- ese constructor parsea como UTC medianoche, y leerlo
 * después con `.getMonth()` (hora local) corre la fecha un día para atrás
 * en cualquier huso horario negativo (Argentina incluida). */
export function ventasPorMes(
  ventas: Venta[],
  meses = 6,
  hoy = new Date(),
): { mes: string; usd: number }[] {
  const totales = new Map<string, number>();
  for (const v of ventas) {
    const clave = v.fechaISO.slice(0, 7); // "YYYY-MM"
    totales.set(clave, (totales.get(clave) ?? 0) + v.totalUsd);
  }
  const out: { mes: string; usd: number }[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ mes: MESES[d.getMonth()], usd: totales.get(clave) ?? 0 });
  }
  return out;
}

/** Facturación real por día, últimos `dias` días (incluye hoy) -- para el
 * gráfico de "facturación acumulada". Mismo cuidado que `ventasPorMes`:
 * las claves de día se arman con aritmética local, nunca `.toISOString()`
 * (esa sí vuelve a UTC y puede correr un día en husos positivos). */
export function facturacionDiaria(ventas: Venta[], dias = 14, hoy = new Date()): number[] {
  const totales = new Map<string, number>();
  for (const v of ventas) {
    totales.set(v.fechaISO.slice(0, 10), (totales.get(v.fechaISO.slice(0, 10)) ?? 0) + v.totalUsd);
  }
  const out: number[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
    out.push(totales.get(claveDia(d.getFullYear(), d.getMonth(), d.getDate())) ?? 0);
  }
  return out;
}
