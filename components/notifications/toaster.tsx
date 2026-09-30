"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ShoppingCart,
  Wrench,
  PackageX,
  CalendarClock,
  Trash2,
  X,
} from "lucide-react";
import { describe, type AppEvent, type ToastView } from "@/lib/realtime";
import { useRealtime } from "@/components/notifications/realtime-provider";
import { cn } from "@/lib/utils";

type Toast = ToastView & { id: number; leaving?: boolean };

const ICONS = {
  sale: ShoppingCart,
  wrench: Wrench,
  package: PackageX,
  calendar: CalendarClock,
  check: Check,
  trash: Trash2,
} as const;

const LIFE_MS = 5000;
const MAX_VISIBLE = 4;

function ToastCard({
  t,
  onDismiss,
  onLeft,
}: {
  t: Toast;
  onDismiss: (id: number) => void;
  onLeft: (id: number) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (t.leaving) {
      // Nació ya "leaving" (ráfaga de eventos que lo desbordó antes de que
      // llegara a montar) -- nunca hubo una entrada visible que animar de
      // salida, así que se saca directo en vez de esperar un transitionend
      // que nunca va a disparar.
      onLeft(t.id);
      return;
    }
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
    // Solo nos interesa el `t.leaving` del montaje -- un dismiss posterior
    // ya lo maneja `onTransitionEnd` más abajo, no este efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Icon = ICONS[t.icon];
  const visible = mounted && !t.leaving;

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-lg shadow-neutral-900/5 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
        visible
          ? "translate-x-0 scale-100 opacity-100"
          : "translate-x-6 scale-[0.96] opacity-0",
      )}
      onTransitionEnd={(e) => {
        if (e.propertyName === "opacity" && t.leaving) onLeft(t.id);
      }}
    >
      <div
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
          t.tone === "warning"
            ? "bg-amber-50 text-amber-600"
            : "bg-blue-50 text-accent",
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-medium leading-snug text-neutral-900">
          {t.title}
        </p>
        <p className="mt-0.5 text-[13px] font-semibold text-neutral-500">
          {t.detail}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "grid h-5 w-5 place-items-center rounded-full",
            t.tone === "warning"
              ? "bg-amber-100 text-amber-600"
              : "bg-emerald-100 text-emerald-600",
          )}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
        <button
          onClick={() => onDismiss(t.id)}
          className="text-neutral-300 hover:text-neutral-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Toaster({ esAdmin }: { esAdmin: boolean }) {
  const { subscribe } = useRealtime();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  function dismiss(id: number) {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
  }

  function remove(id: number) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  useEffect(() => {
    const off = subscribe((e: AppEvent) => {
      const view = describe(e);
      if (view.adminOnly && !esAdmin) return;
      const id = Date.now() + Math.random();
       setToasts((t) => {
         const next = [...t, { id, ...view }];
         const overflow = Math.max(0, next.length - MAX_VISIBLE);
         return next.map((toast, i) =>
           i < overflow ? { ...toast, leaving: true } : toast,
         );
       });
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), LIFE_MS),
      );
    });
    return () => {
      off();
      timers.current.forEach(clearTimeout);
    };
  }, [subscribe, esAdmin]);

  return (
    <div className="pointer-events-none fixed right-6 top-20 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-3">
      {toasts.map((t) => (
        <ToastCard key={t.id} t={t} onDismiss={dismiss} onLeft={remove} />
      ))}
    </div>
  );
}
