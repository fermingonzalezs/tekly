import type { OtroItem } from "@/lib/types";

/** Cantidad total en stock de un producto de "Otros" (serializado o no). */
export function otroCantidad(o: OtroItem): number {
  return o.serializado ? o.unidades.length : o.cantidad;
}

/** Costo promedio por unidad — igual al costo único cuando no es serializado. */
export function otroCostoPromedio(o: OtroItem): number {
  if (!o.serializado) return o.costoUsd;
  if (o.unidades.length === 0) return 0;
  return Math.round(
    o.unidades.reduce((a, u) => a + u.costoUsd, 0) / o.unidades.length,
  );
}

/** Valor total del stock de este producto, a costo. */
export function otroValorStock(o: OtroItem): number {
  return o.serializado
    ? o.unidades.reduce((a, u) => a + u.costoUsd, 0)
    : o.cantidad * o.costoUsd;
}
