/** Lógica pura del form de "Nueva venta" -- sin Supabase, testeable sin
 * red. Extraída de `app/ventas/page.tsx` (antes vivía inline en el
 * componente del modal). */

export type PagoDraft = { montoUsd: number };

/** % de margen sobre precio -- 0 si no hay precio (evita división por 0). */
export function calcularMargenPct(totalPrecio: number, totalCosto: number): number {
  if (totalPrecio <= 0) return 0;
  return ((totalPrecio - totalCosto) / totalPrecio) * 100;
}

/** Lo que falta (positivo) o sobra (negativo) para cubrir el total con los
 * pagos cargados hasta ahora. Redondeado a centavos. */
export function calcularRestante(totalPrecio: number, pagos: PagoDraft[]): number {
  const pagado = pagos.reduce((a, p) => a + p.montoUsd, 0);
  return Math.round((totalPrecio - pagado) * 100) / 100;
}

/** Ajusta el último pago para que la suma cierre exacto con el total
 * (botón "Saldar"). No deja el monto negativo. */
export function saldarUltimoPago<T extends PagoDraft>(pagos: T[], restante: number): T[] {
  if (pagos.length === 0) return pagos;
  const last = pagos[pagos.length - 1];
  const monto = Math.max(0, Math.round((last.montoUsd + restante) * 100) / 100);
  return pagos.map((p, i) => (i === pagos.length - 1 ? { ...p, montoUsd: monto } : p));
}
