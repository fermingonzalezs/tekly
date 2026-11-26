// Precios de venta de los equipos (celulares y notebooks): minorista,
// mayorista y qué precio puede mandar cada rol en «Nueva venta». Puro, sin
// Supabase: lo usan el modal de venta, `createVentaAction` y los tests.

import type { ModalidadVenta } from "@/lib/types";

type ConMayorista = { precioMayoristaUsd?: number | null };

/** Precio mayorista efectivo de una unidad: el propio o, si no tiene, el de
 * su variante. `null` = no hay precio mayorista cargado. */
export function precioMayoristaDe(
  unidad: ConMayorista,
  variante: ConMayorista | null | undefined,
): number | null {
  const propio = unidad.precioMayoristaUsd;
  if (propio !== null && propio !== undefined) return propio;
  const deVariante = variante?.precioMayoristaUsd;
  return deVariante !== null && deVariante !== undefined ? deVariante : null;
}

/** Precio con el que entra un equipo a la venta según la modalidad: en
 * «Mayorista» el mayorista efectivo, o el de lista si no hay uno cargado. */
export function precioSegunModalidad(
  precioUsd: number,
  mayoristaUsd: number | null,
  modalidad: ModalidadVenta,
): number {
  return modalidad === "mayorista" && mayoristaUsd !== null ? mayoristaUsd : precioUsd;
}

/** Precios que acepta el server para un ítem del stock: el de lista y, en
 * una venta mayorista, también el mayorista. El admin puede mandar
 * cualquiera (lo edita a mano en el modal): esto rige para el resto. */
export function preciosPermitidos(
  precioUsd: number,
  mayoristaUsd: number | null,
  modalidad: ModalidadVenta,
): number[] {
  return modalidad === "mayorista" && mayoristaUsd !== null
    ? [precioUsd, mayoristaUsd]
    : [precioUsd];
}

const igual = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** `null` si `pedido` es un precio que ese rol puede usar; si no, el error. */
export function errorPrecioItem(params: {
  detalle: string;
  pedido: number;
  permitidos: number[];
  esAdmin: boolean;
}): string | null {
  if (!Number.isFinite(params.pedido) || params.pedido < 0) {
    return `El precio de «${params.detalle}» no es válido.`;
  }
  if (params.esAdmin) return null;
  if (params.permitidos.some((p) => igual(p, params.pedido))) return null;
  return `Solo un admin puede cambiar el precio de «${params.detalle}». Si el precio cambió en el stock, cerrá y volvé a abrir «Nueva venta».`;
}

/** Faltante aceptado al confirmar la venta: total − cobrado (U$, ≥ 0,
 * redondeado a centavos). Lo que sobra no es una diferencia válida. */
export function diferenciaDeVenta(totalUsd: number, cobradoUsd: number): number {
  return Math.round(Math.max(0, totalUsd - cobradoUsd) * 100) / 100;
}

/** Valida la diferencia del server: si falta cobrar, el cliente tiene que
 * haber aceptado exactamente ese faltante (el cartel de confirmación); si
 * sobra plata, la venta no se puede guardar. */
export function errorDiferencia(params: {
  totalUsd: number;
  cobradoUsd: number;
  aceptadaUsd: number;
}): string | null {
  const resto = params.totalUsd - params.cobradoUsd;
  if (resto < -0.005) return "Los pagos superan el total de la venta.";
  const diferencia = diferenciaDeVenta(params.totalUsd, params.cobradoUsd);
  if (diferencia === 0) return null;
  if (!igual(diferencia, params.aceptadaUsd)) {
    return "Los pagos no cubren el total. Revisá los montos y confirmá la diferencia de nuevo.";
  }
  return null;
}
