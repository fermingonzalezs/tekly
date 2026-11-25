import type { Ticket, TicketServicio } from "@/lib/types";
import type { Rol } from "@/lib/auth/types";

/** Rentabilidad de un ticket: precio total de sus ítems menos el costo de
 * los repuestos usados. La mano de obra (servicios del catálogo / ítems
 * libres) no tiene costo de mercadería: es ganancia. El costo de cada
 * repuesto es el congelado al agregarlo (`TicketServicio.costoUsd`); en
 * tickets viejos sin snapshot, el costo actual del repuesto. Lógica pura
 * (la usan el detalle del ticket y Analíticas). */
export function rentabilidadTicket(
  servicios: TicketServicio[],
  costoRepuestoActual: (repuestoId: string) => number | undefined = () => undefined,
): {
  precioUsd: number;
  costoUsd: number;
  gananciaUsd: number;
  margenPct: number | null;
  /** Repuestos sin costo conocido (no entran en el costo). */
  sinCosto: number;
} {
  let precio = 0;
  let costo = 0;
  let sinCosto = 0;
  for (const s of servicios) {
    const cantidad = s.cantidad ?? 1;
    precio += s.precioUsd * cantidad;
    const c = costoDeItem(s, costoRepuestoActual);
    if (c === undefined) {
      if (s.origen === "repuesto") sinCosto += 1;
      continue;
    }
    costo += c * cantidad;
  }
  return {
    precioUsd: precio,
    costoUsd: costo,
    gananciaUsd: precio - costo,
    margenPct: precio > 0 ? ((precio - costo) / precio) * 100 : null,
    sinCosto,
  };
}

/** Costo unitario de un ítem de ticket: snapshot, o (repuesto sin
 * snapshot) el costo actual del repuesto. Servicio/libre sin costo cargado
 * → `undefined`. */
export function costoDeItem(
  s: TicketServicio,
  costoRepuestoActual: (repuestoId: string) => number | undefined,
): number | undefined {
  if (s.costoUsd !== undefined) return s.costoUsd;
  if (s.origen === "repuesto" && s.repuestoId) return costoRepuestoActual(s.repuestoId);
  return undefined;
}

/** El vendedor no recibe costos: se borra el snapshot de cada ítem antes de
 * mandar el ticket al cliente (todo lo que viaja en el payload se lee). */
export function ticketParaRol<T extends Pick<Ticket, "servicios">>(ticket: T, rol: Rol): T {
  if (rol !== "vendedor") return ticket;
  return {
    ...ticket,
    servicios: ticket.servicios.map(({ costoUsd: _c, ...s }) => s),
  };
}
