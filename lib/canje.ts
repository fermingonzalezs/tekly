/** Celular recibido en canje (pago «Mercadería» de Nueva venta). Lógica pura,
 * sin Supabase: la usan el modal (`CanjeModal`), `createVenta` (que nunca
 * confía en lo que manda el cliente) y «Pasar al stock» de Compras.
 *
 * El equipo **no entra al stock** al confirmar la venta: queda registrado en
 * su compra `origen: "canje"` y se pasa al inventario después, eligiendo la
 * variante recién ahí. */

import type { CanjeEquipo } from "@/lib/types";
import { BATERIA_CELULAR_NUEVO, CONDICIONES_CELULAR, esCelularNuevo } from "@/lib/status";

/** Batería efectiva: 100 si es NUEVO (no aplica), si no la cargada. */
export function bateriaCanje(c: Pick<CanjeEquipo, "condicion" | "bateria">): number | undefined {
  if (esCelularNuevo(c.condicion)) return BATERIA_CELULAR_NUEVO;
  return c.bateria;
}

/** Errores del equipo + el precio de compra (= monto del pago «Mercadería»).
 * Vacío = válido. */
export function erroresCanje(c: CanjeEquipo | undefined, precioUsd: number): string[] {
  if (!c) return ["Falta cargar el equipo del canje."];
  const errores: string[] = [];
  if (!c.modelo?.trim()) errores.push("Falta el modelo del equipo.");
  if (!c.imei?.trim()) errores.push("Falta el IMEI / serial del equipo.");
  if (!c.color?.trim()) errores.push("Falta el color del equipo.");
  if (!(CONDICIONES_CELULAR as readonly string[]).includes(c.condicion)) {
    errores.push("Elegí el estado (condición) del equipo.");
  }
  if (!esCelularNuevo(c.condicion)) {
    const b = c.bateria;
    if (b === undefined || !Number.isFinite(b) || b < 0 || b > 100 || !Number.isInteger(b)) {
      errores.push("Cargá el % de batería (0 a 100).");
    }
  }
  if (!(precioUsd > 0)) errores.push("Cargá el precio de compra del equipo.");
  return errores;
}

/** Texto corto para mostrar el equipo cargado: «iPhone 13 · Negro · A · 87 %». */
export function resumenCanje(c: CanjeEquipo): string {
  const bat = bateriaCanje(c);
  return [
    c.modelo.trim(),
    c.color.trim(),
    c.condicion,
    !esCelularNuevo(c.condicion) && bat !== undefined ? `${bat} %` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
