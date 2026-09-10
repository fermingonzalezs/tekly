import type {
  EquipoStatus,
  MedioPago,
  OtroCategoria,
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
  aprobado_para_venta: { label: "Aprobado p/ venta", tone: "violet" },
  disponible: { label: "Disponible", tone: "green" },
  vendido: { label: "Vendido", tone: "gray" },
};

// ── Turnos ─────────────────────────────────────────────────────

export const turnoStatus: Record<
  TurnoEstado,
  { label: string; tone: Tone }
> = {
  pendiente: { label: "Pendiente", tone: "gray" },
  confirmado: { label: "Confirmado", tone: "blue" },
  llego: { label: "Llegó", tone: "green" },
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

// ── Medios de pago ─────────────────────────────────────────────

export const medioPago: Record<MedioPago, { label: string; tone: Tone }> = {
  pesos: { label: "Pesos", tone: "green" },
  dolares: { label: "Dólares", tone: "green" },
  transferencia: { label: "Transferencia", tone: "blue" },
  cripto: { label: "Cripto", tone: "violet" },
  tarjeta: { label: "Tarjeta", tone: "amber" },
  canje: { label: "Canje", tone: "gray" },
};
