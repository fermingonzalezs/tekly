import type { OtroItem, OtroUnidad } from "@/lib/types";

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

/** Unidades que se pueden vender: la cantidad, o las unidades serializadas
 * que no están vendidas ni reservadas (sin `estado` = disponible). */
export function otroDisponibles(o: OtroItem): number {
  if (!o.serializado) return Math.max(0, o.cantidad);
  return o.unidades.filter((u) => (u.estado ?? "disponible") === "disponible").length;
}

/**
 * Cambio de stock de un producto de "Otros" al vender/regalar (`egreso`) o al
 * devolverlo borrando la venta (`ingreso`). Serializado: la unidad `serial`
 * pasa a vendida / disponible. Por cantidad: resta o suma. Nunca deja stock
 * negativo ni vende una unidad que no está disponible.
 */
export function movimientoStockOtro(
  o: OtroItem,
  mov: { cantidad: number; serial?: string },
  sentido: "egreso" | "ingreso",
):
  | { ok: true; patch: { cantidad: number } | { unidades: OtroUnidad[] } }
  | { ok: false; error: string } {
  const cantidad = Math.max(1, Math.round(mov.cantidad));
  if (o.serializado) {
    const idx = o.unidades.findIndex((u) => u.serial === mov.serial);
    if (!mov.serial || idx === -1) {
      return { ok: false, error: `Falta la unidad (serial) de «${o.nombre}».` };
    }
    const estado = o.unidades[idx].estado ?? "disponible";
    if (sentido === "egreso" && estado !== "disponible") {
      return { ok: false, error: `La unidad ${mov.serial} de «${o.nombre}» no está disponible.` };
    }
    const unidades = o.unidades.map((u, i) =>
      i === idx ? { ...u, estado: sentido === "egreso" ? ("vendido" as const) : ("disponible" as const) } : u,
    );
    return { ok: true, patch: { unidades } };
  }
  if (sentido === "egreso" && o.cantidad < cantidad) {
    return { ok: false, error: `No hay stock suficiente de «${o.nombre}» (quedan ${o.cantidad}).` };
  }
  return {
    ok: true,
    patch: { cantidad: o.cantidad + (sentido === "egreso" ? -cantidad : cantidad) },
  };
}
