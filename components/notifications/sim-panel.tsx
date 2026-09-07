"use client";

import { useState } from "react";
import { Zap, X } from "lucide-react";
import { publish, transport, type AppEvent } from "@/lib/realtime";
import { cn } from "@/lib/utils";

const ACTORS = ["Nico (técnico)", "Caro (ventas)", "Dueño", "Meli (ventas)"];
const MODELS = ["iPhone 12", "iPhone 13 Pro", "iPhone 15", "Samsung S22"];
const PARTS = ["Pantalla iPhone 13", "Batería iPhone 12", "Flex de carga 15"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rnd = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min) + min);

const PRESETS: { label: string; build: () => AppEvent }[] = [
  {
    label: "Venta confirmada",
    build: () => ({
      type: "sale_confirmed",
      actor: pick(ACTORS),
      amountUsd: rnd(180, 1200),
      ref: `V-${rnd(1000, 9999)}`,
    }),
  },
  {
    label: "Ticket listo",
    build: () => ({
      type: "ticket_ready",
      actor: pick(ACTORS),
      ticket: rnd(100, 199),
      model: pick(MODELS),
    }),
  },
  {
    label: "Presupuesto aprobado",
    build: () => ({
      type: "repair_approved",
      actor: pick(ACTORS),
      ticket: rnd(100, 199),
      amountUsd: rnd(40, 320),
    }),
  },
  {
    label: "Cliente llegó al turno",
    build: () => ({
      type: "appointment_arrived",
      actor: pick(ACTORS),
      client: pick(["Juan P.", "Sofía R.", "Marco D.", "Lu V."]),
      ticket: rnd(100, 199),
    }),
  },
  {
    label: "Stock bajo",
    build: () => ({
      type: "low_stock",
      actor: pick(ACTORS),
      part: pick(PARTS),
      qty: rnd(0, 3),
    }),
  },
];

export function SimPanel() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  function fire(label: string, build: () => AppEvent) {
    publish(build());
    setSent(label);
    setTimeout(() => setSent(null), 1500);
  }

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {open && (
        <div className="animate-toast-in mb-3 w-72 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Simulador de eventos</p>
            <button
              onClick={() => setOpen(false)}
              className="text-neutral-400 hover:text-neutral-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            Abrí otra pestaña para ver el toast entrar en tiempo real.
          </p>
          <div className="mt-3 space-y-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => fire(p.label, p.build)}
                className="flex w-full items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-left text-[13px] font-medium text-neutral-700 hover:border-accent hover:bg-accent-soft"
              >
                {p.label}
                <span className="text-neutral-300">→</span>
              </button>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-neutral-400">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                transport === "supabase" ? "bg-emerald-500" : "bg-amber-500",
              )}
            />
            {transport === "supabase"
              ? "Supabase Realtime Broadcast"
              : "BroadcastChannel (cross-tab local)"}
          </p>
          {sent && (
            <p className="mt-2 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
              Evento enviado: {sent} ✓
            </p>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-4 text-sm font-medium text-white shadow-lg hover:bg-neutral-800"
      >
        <Zap className="h-4 w-4" />
        Simular
      </button>
    </div>
  );
}
