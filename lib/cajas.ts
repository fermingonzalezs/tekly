import type { MedioPago } from "@/lib/types";

/** Lógica pura de cajas/conciliación -- sin Supabase, testeable sin red.
 * `lib/db/cajas.ts` es quien trae los movimientos de la base y le pasa el
 * resultado a estas funciones. */

export type MovimientoSigno = { tipo: "ingreso" | "egreso"; monto: number };

/** Monto con signo: ingreso suma, egreso resta. */
export function signo(m: MovimientoSigno): number {
  return m.tipo === "ingreso" ? m.monto : -m.monto;
}

/** Neto de una lista de movimientos -- lo que el sistema espera encontrar
 * en la caja contando todos ellos (típicamente: movimientos desde la
 * última conciliación, ya filtrados por caja en `lib/db/cajas.ts`). */
export function netoMovimientos(movimientos: MovimientoSigno[]): number {
  return movimientos.reduce((acc, m) => acc + signo(m), 0);
}

export type PagoConCaja = { medio: MedioPago; montoUsd: number; caja: "usd" | "ars" };

/** Convierte un monto de una caja a ARS -- usd * cotización, ars igual. */
export function enArs(montoCaja: number, moneda: "usd" | "ars", cotizacion: number): number {
  return moneda === "ars" ? montoCaja : montoCaja * cotizacion;
}
