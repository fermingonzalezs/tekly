/** Lógica pura del form de "Nueva venta" -- sin Supabase, testeable sin
 * red. Extraída de `app/ventas/page.tsx` (antes vivía inline en el
 * componente del modal). */

import type { VentaItem } from "@/lib/types";

export type PagoDraft = { montoUsd: number };

export type Rubro = NonNullable<VentaItem["categoria"]>;

export const RUBRO_LABEL: Record<Rubro, string> = {
  equipo: "Equipos",
  servicio: "Reparaciones",
  otro: "Accesorios",
  libre: "Otros",
};

export const RUBRO_ORDEN = Object.keys(RUBRO_LABEL) as Rubro[];

/** Ventas de antes de trackear `VentaItem.categoria` sólo permiten inferir
 * con certeza el caso "equipo" (tiene `equipoId`); el resto cae en "Otros"
 * en vez de adivinar servicio/producto/libre. Compartida entre
 * `ventasPorRubro` (dashboard) y `margenPorTipo` (analíticas) -- una sola
 * fuente de verdad para el rubro de un ítem. */
export function categoriaDe(item: VentaItem): Rubro {
  return item.categoria ?? (item.equipoId ? "equipo" : "libre");
}

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

/** Monto real cobrado/movido por un pago con recargo -- `montoUsd` sigue
 * siendo la parte del total de la venta que ese pago cubre (no cambia
 * `calcularRestante`/`saldarUltimoPago`); esto es solo lo que el medio con
 * recargo hace pagar de más por arriba, para el movimiento de caja/cuenta
 * corriente que genera y para el aviso en "Nueva venta". */
export function montoConRecargo(montoUsd: number, recargoPct: number | undefined): number {
  if (!recargoPct) return montoUsd;
  return Math.round(montoUsd * (1 + recargoPct / 100) * 100) / 100;
}
