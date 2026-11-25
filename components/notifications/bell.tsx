"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCircle2, X } from "lucide-react";
import { describe, type AppEvent, type ToastView } from "@/lib/realtime";
import { useRealtime } from "@/components/notifications/realtime-provider";
import { marcarResolucionesVistasAction } from "@/app/(app)/actions";
import { fmtDateSlash } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ResolucionReporte } from "@/lib/types";

type Notif = ToastView & { id: number; ts: number; read: boolean };

function ago(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `hace ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m}m`;
  return `hace ${Math.round(m / 60)}h`;
}

export function NotificationsBell({
  esAdmin,
  resoluciones = [],
}: {
  esAdmin: boolean;
  /** Respuestas a «Reportar un problema» del usuario (persistidas, vienen del
   * server en cada carga). Las no vistas cuentan como no leídas hasta que se
   * abre la campanita. */
  resoluciones?: ResolucionReporte[];
}) {
  const { subscribe } = useRealtime();
  const [list, setList] = useState<Notif[]>([]);
  // Las que se marcaron vistas en esta sesión (el server las devuelve con
  // `visto: true` recién en la próxima carga). `resaltadas` = las que eran
  // nuevas al abrir: siguen resaltadas mientras el panel está abierto.
  const [vistasAhora, setVistasAhora] = useState<Set<string>>(new Set());
  const [resaltadas, setResaltadas] = useState<Set<string>>(new Set());
  // Respuesta abierta en el modal (click en la notificación).
  const [detalle, setDetalle] = useState<ResolucionReporte | null>(null);
  const noVistas = resoluciones.filter((r) => !r.visto && !vistasAhora.has(r.id));
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribe((e: AppEvent) => {
      const view = describe(e);
      if (view.adminOnly && !esAdmin) return;
      setList((p) => [
        { id: Date.now() + Math.random(), ts: Date.now(), read: false, ...view },
        ...p,
      ]);
    });
  }, [subscribe, esAdmin]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  const unread = list.filter((n) => !n.read).length + noVistas.length;

  function abrirCerrar() {
    if (!open && noVistas.length > 0) {
      const ids = noVistas.map((r) => r.id);
      setResaltadas(new Set(ids));
      setVistasAhora((prev) => new Set([...prev, ...ids]));
      // Best-effort: si falla, vuelven a aparecer como nuevas en la próxima carga.
      void marcarResolucionesVistasAction(ids).catch(() => {});
    }
    if (open) setResaltadas(new Set());
    setOpen((v) => !v);
  }

  function dismiss(id: number) {
    setList((p) => p.filter((n) => n.id !== id));
  }

  function markAllRead() {
    setList((p) => p.map((n) => ({ ...n, read: true })));
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={abrirCerrar}
        aria-label="Notificaciones"
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
        <div className="animate-menu-in origin-top-right absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Notificaciones
            </p>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] font-semibold text-accent hover:text-accent/80"
              >
                Marcar todas como vistas
              </button>
            )}
          </div>
          <div className="max-h-[22rem] overflow-y-auto">
            {resoluciones.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setDetalle(r);
                  setOpen(false);
                  setResaltadas(new Set());
                }}
                className={cn(
                  "flex w-full items-start gap-2.5 border-b border-neutral-50 px-4 py-2.5 text-left transition-colors hover:bg-neutral-50",
                  resaltadas.has(r.id) && "bg-accent-soft/60",
                )}
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-snug text-neutral-900">
                    Arreglamos un problema que reportaste
                  </p>
                  <p className="line-clamp-2 text-xs text-neutral-700">{r.respuesta}</p>
                  <p className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-neutral-400">
                    {fmtDateSlash(r.resueltoAt)}
                    <span className="font-semibold text-accent">Ver detalle</span>
                  </p>
                </div>
              </button>
            ))}
            {list.length === 0 && resoluciones.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-neutral-400">
                Sin notificaciones todavía.
              </p>
            )}
            {list.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "relative flex items-start gap-2.5 border-b border-neutral-50 px-4 py-2.5 pr-8 last:border-b-0",
                  !n.read && "bg-accent-soft/60",
                )}
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
                <button
                  onClick={() => dismiss(n.id)}
                  className="absolute right-2.5 top-2.5 text-neutral-300 hover:text-neutral-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog
        open={!!detalle}
        onClose={() => setDetalle(null)}
        size="lg"
        title="Problema resuelto"
        description={detalle ? `Resuelto el ${fmtDateSlash(detalle.resueltoAt)}` : undefined}
        footer={
          <Button variant="primary" onClick={() => setDetalle(null)} fullOnMobile>
            Entendido
          </Button>
        }
      >
        {detalle && (
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Qué arreglamos
              </p>
              <div className="mt-1.5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p className="whitespace-pre-wrap text-sm text-neutral-800">{detalle.respuesta}</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Lo que reportaste
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-neutral-600">
                {detalle.descripcion}
              </p>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
