"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import {
  subscribe,
  describe,
  type AppEvent,
  type ToastView,
} from "@/lib/realtime";
import { cn } from "@/lib/utils";

type Notif = ToastView & { id: number; ts: number };

function ago(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `hace ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m}m`;
  return `hace ${Math.round(m / 60)}h`;
}

export function NotificationsBell() {
  const [list, setList] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribe((e: AppEvent) => {
      setList((p) =>
        [
          { id: Date.now() + Math.random(), ts: Date.now(), ...describe(e) },
          ...p,
        ].slice(0, 15),
      );
    });
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    setSeen(list.length);
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, list.length]);

  const unread = Math.max(0, list.length - seen);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative grid h-9 w-9 place-items-center rounded-full border bg-white text-neutral-500 transition-colors hover:bg-neutral-50",
          open ? "border-accent text-accent" : "border-neutral-200",
        )}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-toast-in absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
          <div className="border-b border-neutral-100 px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Notificaciones
            </p>
          </div>
          <div className="max-h-[22rem] overflow-y-auto">
            {list.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-neutral-400">
                Sin notificaciones todavía.
              </p>
            )}
            {list.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-2.5 border-b border-neutral-50 px-4 py-2.5 last:border-b-0"
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    n.tone === "warning" ? "bg-amber-500" : "bg-emerald-500",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-snug text-neutral-900">
                    {n.title}
                  </p>
                  <p className="text-xs text-neutral-500">{n.detail}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-400">
                    {ago(n.ts, now)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
