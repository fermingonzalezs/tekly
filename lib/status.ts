import type {
  CompraEstado,
  EquipoStatus,
  MedioPago,
  MedioPagoVenta,
  OtroCategoria,
  Role,
  TicketStatus,
  TurnoEstado,
  TurnoTipo,
} from "@/lib/types";

export type Tone = "blue" | "amber" | "green" | "gray" | "red" | "violet";

export const toneClass: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  gray: "bg-neutral-100 text-neutral-600 ring-neutral-500/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
};

export const dotClass: Record<Tone, string> = {
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  gray: "bg-neutral-400",
  red: "bg-red-500",
  violet: "bg-violet-500",
};

// ── Usuarios y roles ───────────────────────────────────────────

export const rolTone: Record<Role, Tone> = {
  admin: "violet",
  vendedor: "blue",
  tecnico: "green",
};

export const rolLabel: Record<Role, string> = {
  admin: "Admin / Dueño",
  vendedor: "Vendedor",
  tecnico: "Técnico",
};

// ── Tickets de reparación ──────────────────────────────────────

export const TICKET_FLOW: TicketStatus[] = [
  "recibido",
  "diagnosticado",
  "presupuestado",
  "aprobado",
  "en_reparacion",
  "esperando_repuesto",
  "listo",
  "entregado",
];

export const ticketStatus: Record<
  TicketStatus,
  { label: string; tone: Tone }
> = {
  recibido: { label: "Recibido", tone: "gray" },
  diagnosticado: { label: "Diagnosticado", tone: "blue" },
  presupuestado: { label: "Presupuestado", tone: "blue" },
  aprobado: { label: "Aprobado", tone: "violet" },
  en_reparacion: { label: "En reparación", tone: "blue" },
  esperando_repuesto: { label: "Esperando repuesto", tone: "amber" },
  listo: { label: "Listo", tone: "green" },
  entregado: { label: "Entregado", tone: "gray" },
};

export function nextTicketStatus(s: TicketStatus): TicketStatus | null {
  const i = TICKET_FLOW.indexOf(s);
  return i >= 0 && i < TICKET_FLOW.length - 1 ? TICKET_FLOW[i + 1] : null;
}

// ── Equipos de inventario ──────────────────────────────────────

export const equipoStatus: Record<
  EquipoStatus,
  { label: string; tone: Tone }
> = {
  en_revision: { label: "En revisión", tone: "amber" },
  disponible: { label: "Disponible", tone: "green" },
  reservado: { label: "Reservado", tone: "blue" },
  vendido: { label: "Vendido", tone: "gray" },
};

// ── Turnos ─────────────────────────────────────────────────────

export const turnoStatus: Record<
  TurnoEstado,
  { label: string; tone: Tone }
> = {
  pendiente: { label: "Pendiente", tone: "gray" },
  confirmado: { label: "Confirmado", tone: "blue" },
  cancelado: { label: "Cancelado", tone: "red" },
};

/** Motivo del turno → color en el calendario. */
export const turnoTipo: Record<TurnoTipo, { label: string; tone: Tone }> = {
  compra: { label: "Compra equipo", tone: "green" },
  deja: { label: "Deja reparación", tone: "blue" },
  retira: { label: "Retira reparación", tone: "violet" },
  cotizar: { label: "Cotizar", tone: "amber" },
};

// ── Inventario · Repuestos ─────────────────────────────────────

export function repuestoEstado(
  stock: number,
  min: number,
): { label: string; tone: Tone } {
  if (stock <= 0) return { label: "Sin stock", tone: "red" };
  if (stock <= min) return { label: "Stock bajo", tone: "amber" };
  return { label: "OK", tone: "green" };
}

// ── Inventario · Otros productos ───────────────────────────────

export const otroCategoria: Record<OtroCategoria, { label: string; tone: Tone }> = {
  ipad: { label: "iPad", tone: "blue" },
  airpods: { label: "AirPods", tone: "violet" },
  tablet: { label: "Tablet", tone: "green" },
  accesorio: { label: "Accesorio", tone: "gray" },
  otro: { label: "Otro", tone: "gray" },
};

// ── Compras ────────────────────────────────────────────────────

export const compraEstado: Record<
  CompraEstado,
  { label: string; tone: Tone }
> = {
  pendiente: { label: "Pendiente", tone: "amber" },
  recibida: { label: "Recibida", tone: "green" },
};

// ── Medios de pago ─────────────────────────────────────────────

/** Superset de `MedioPago` -- `cuenta_corriente` solo tiene sentido como
 * `Pago.medio` (ver `lib/types.ts`), nunca como medio de una `Caja`/
 * `MovimientoCaja`/`Compra`, pero el mapa vive acá único para que Ventas
 * y el resto (Cajas/Compras/Turnos, que siguen indexando con `MedioPago`)
 * comparta label/tone/emoji. */
export const medioPago: Record<MedioPagoVenta, { label: string; tone: Tone; emoji: string }> = {
  pesos: { label: "Efectivo (pesos)", tone: "green", emoji: "💵" },
  dolares: { label: "Dólares", tone: "green", emoji: "💲" },
  transferencia: { label: "Transferencia", tone: "blue", emoji: "🏦" },
  cripto: { label: "Cripto", tone: "violet", emoji: "🪙" },
  tarjeta: { label: "Tarjeta de crédito", tone: "amber", emoji: "💳" },
  canje: { label: "Mercadería", tone: "gray", emoji: "📦" },
  cuenta_corriente: { label: "Cuenta corriente", tone: "gray", emoji: "📒" },
};

/** Medios válidos para una `Caja`/`MovimientoCaja`/`Compra` -- fuente
 * única para los selectores de esas tres secciones + Turnos (antes cada
 * uno tenía su propio array `MEDIOS` duplicado). "Cuenta corriente" queda
 * afuera a propósito: nunca es el medio de una caja real. */
export const MEDIOS_CAJA: MedioPago[] = [
  "pesos",
  "dolares",
  "transferencia",
  "cripto",
  "tarjeta",
  "canje",
];

/** `MEDIOS_CAJA` + "cuenta corriente" -- para los lugares que necesitan
 * los 7 medios (ej. el form de recargo por medio en Configuración). */
export const MEDIOS_VENTA: MedioPagoVenta[] = [...MEDIOS_CAJA, "cuenta_corriente"];
