"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/** Confirmación grande, a pantalla completa, después de guardar una venta:
 * check animado (mismo trazo que `ConfirmarAltaDialog`) + «Venta confirmada»
 * y un resumen. Se cierra sola a los ~2 s, con un click o con Esc. */
export function VentaConfirmada({
  detalle,
  onClose,
}: {
  /** Ej. «V-1042 · Juan Pérez · U$850». `null` = cerrada. */
  detalle: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (detalle === null) return;
    const t = setTimeout(onClose, 2200);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [detalle, onClose]);

  if (detalle === null || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/20 backdrop-blur-[2px]"
      onClick={onClose}
      role="status"
      aria-live="polite"
    >
      <div className="animate-celebrate-in flex flex-col items-center gap-4 rounded-3xl bg-white px-12 py-10 text-center shadow-2xl">
        <div className="animate-celebrate-check flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
          <svg viewBox="0 0 24 24" className="h-14 w-14" fill="none" aria-hidden>
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              className="animate-check-draw"
            />
          </svg>
        </div>
        <p className="text-2xl font-semibold text-neutral-900">Venta confirmada</p>
        <p className="text-sm tabular-nums text-neutral-500">{detalle}</p>
      </div>
    </div>,
    document.body,
  );
}
