"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Pub/sub de eventos entre sesiones de browser.
 * - Si hay credenciales de Supabase -> Realtime Broadcast (cross-device, cross-red).
 * - Si no -> BroadcastChannel nativo (cross-tab en el mismo browser). Suficiente
 *   para probar el sistema de toasts abriendo dos pestañas.
 * En ambos casos el emisor NO recibe su propio evento (son "acciones de otros").
 */

export type AppEvent =
  | { type: "sale_confirmed"; actor: string; amountUsd: number; ref: string }
  | { type: "ticket_ready"; actor: string; ticket: number; model: string }
  | { type: "low_stock"; actor: string; part: string; qty: number }
  | { type: "appointment_arrived"; actor: string; client: string; ticket: number }
  | { type: "repair_approved"; actor: string; ticket: number; amountUsd: number };

type Listener = (e: AppEvent) => void;

const CHANNEL = "crm-events";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const transport: "supabase" | "broadcastchannel" =
  url && key ? "supabase" : "broadcastchannel";

let publishImpl: (e: AppEvent) => void = () => {};
let subscribeImpl: (fn: Listener) => () => void = () => () => {};

if (typeof window !== "undefined") {
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const ch = supabase.channel(CHANNEL, {
      config: { broadcast: { self: false } },
    });
    const listeners = new Set<Listener>();
    ch.on("broadcast", { event: "app" }, ({ payload }) => {
      listeners.forEach((fn) => fn(payload as AppEvent));
    }).subscribe();

    publishImpl = (e) => {
      void ch.send({ type: "broadcast", event: "app", payload: e });
    };
    subscribeImpl = (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    };
  } else {
    const bc = new BroadcastChannel(CHANNEL);
    const listeners = new Set<Listener>();
    bc.onmessage = (ev) => listeners.forEach((fn) => fn(ev.data as AppEvent));
    publishImpl = (e) => bc.postMessage(e);
    subscribeImpl = (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    };
  }
}

export const publish = (e: AppEvent) => publishImpl(e);
export const subscribe = (fn: Listener) => subscribeImpl(fn);

// ---- presentación ----------------------------------------------------------

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
        detail: `+USD ${e.amountUsd.toLocaleString("en-US")} · ${e.ref}`,
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
        detail: `USD ${e.amountUsd.toLocaleString("en-US")} · ${e.actor}`,
        tone: "success",
      };
    case "appointment_arrived":
      return {
        icon: "calendar",
        title: `${e.client} llegó a su turno`,
        detail: `Vinculado al ticket #${e.ticket}`,
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
