import { fmtUsd } from "@/lib/format";

/**
 * Tipos de evento + presentación del toast. El transporte (Supabase
 * Realtime Broadcast vs. `BroadcastChannel`, con canal *por organización*)
 * vive en `components/notifications/realtime-provider.tsx` (`useRealtime()`)
 * -- este módulo no toca `window` ni sabe de Supabase, así que es seguro
 * importarlo desde cualquier lado (server o client).
 */

export type AppEvent =
  | { type: "sale_confirmed"; actor: string; amountUsd: number; ref: string }
  | { type: "ticket_ready"; actor: string; ticket: number; model: string }
  | { type: "low_stock"; actor: string; part: string; qty: number }
  | { type: "appointment_arrived"; actor: string; client: string; ticket: number }
  | { type: "appointment_scheduled"; actor: string; client: string; tipoLabel: string; when: string }
  | { type: "repair_approved"; actor: string; ticket: number; amountUsd: number };

export type ToastView = {
  icon: "sale" | "wrench" | "package" | "calendar" | "check";
  title: string;
  detail: string;
  tone: "success" | "warning";
};

export function describe(e: AppEvent): ToastView {
  switch (e.type) {
    case "sale_confirmed":
      return {
        icon: "sale",
        title: `${e.actor} confirmó una venta`,
        detail: `+${fmtUsd(e.amountUsd)} · ${e.ref}`,
        tone: "success",
      };
    case "ticket_ready":
      return {
        icon: "wrench",
        title: `Ticket #${e.ticket} listo`,
        detail: `${e.model} · marcó ${e.actor}`,
        tone: "success",
      };
    case "repair_approved":
      return {
        icon: "check",
        title: `Presupuesto aprobado · Ticket #${e.ticket}`,
        detail: `${fmtUsd(e.amountUsd)} · ${e.actor}`,
        tone: "success",
      };
    case "appointment_arrived":
      return {
        icon: "calendar",
        title: `${e.client} llegó a su turno`,
        detail: `Vinculado al ticket #${e.ticket}`,
        tone: "success",
      };
    case "appointment_scheduled":
      return {
        icon: "calendar",
        title: `Nuevo turno · ${e.client}`,
        detail: `${e.tipoLabel} · ${e.when} · agendó ${e.actor}`,
        tone: "success",
      };
    case "low_stock":
      return {
        icon: "package",
        title: "Stock bajo",
        detail: `${e.part} · quedan ${e.qty}`,
        tone: "warning",
      };
  }
}
