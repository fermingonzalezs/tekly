"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import type { AppEvent } from "@/lib/realtime";

/**
 * Transporte del pub/sub de notificaciones, con estado en React (no un
 * singleton de módulo) porque necesita `organizationId` para armar un canal
 * *por organización* -- sin esto, cualquier evento (venta confirmada,
 * ticket listo, ...) se vería en TODAS las organizaciones de la app, no
 * solo en la propia. Ver `lib/realtime.ts` para los tipos y `describe()`.
 */

type Listener = (e: AppEvent) => void;

type RealtimeCtx = {
  /** `self: true` entrega el evento además a los listeners locales (la
   * propia pestaña), no solo al canal -- lo usa el SimPanel para testear
   * sin depender del transporte ni de una segunda pestaña. */
  publish: (e: AppEvent, opts?: { self?: boolean }) => void;
  subscribe: (fn: Listener) => () => void;
  transport: "supabase" | "broadcastchannel";
};

const Ctx = createContext<RealtimeCtx | null>(null);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function RealtimeProvider({
  organizationId,
  children,
}: {
  organizationId: string;
  children: React.ReactNode;
}) {
  const listenersRef = useRef(new Set<Listener>());
  const publishImplRef = useRef<(e: AppEvent) => void>(() => {});

  useEffect(() => {
    const channelName = `crm-events:${organizationId}`;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      });
      const ch = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      });
      ch.on("broadcast", { event: "app" }, ({ payload }) => {
        listenersRef.current.forEach((fn) => fn(payload as AppEvent));
      }).subscribe();
      publishImplRef.current = (e) => {
        void ch.send({ type: "broadcast", event: "app", payload: e });
      };
      return () => {
        void supabase.removeChannel(ch);
      };
    }

    const bc = new BroadcastChannel(channelName);
    bc.onmessage = (ev) => listenersRef.current.forEach((fn) => fn(ev.data as AppEvent));
    publishImplRef.current = (e) => bc.postMessage(e);
    return () => bc.close();
  }, [organizationId]);

  const value = useMemo<RealtimeCtx>(
    () => ({
      publish: (e, opts) => {
        if (opts?.self) listenersRef.current.forEach((fn) => fn(e));
        publishImplRef.current(e);
      },
      subscribe: (fn) => {
        listenersRef.current.add(fn);
        return () => listenersRef.current.delete(fn);
      },
      transport: supabaseUrl && supabaseKey ? "supabase" : "broadcastchannel",
    }),
    [],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRealtime(): RealtimeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRealtime() tiene que usarse dentro de <RealtimeProvider>");
  return ctx;
}
