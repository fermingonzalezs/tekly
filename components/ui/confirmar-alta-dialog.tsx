"use client";

import { useEffect } from "react";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export type FilaResumen = { label: string; value: React.ReactNode };

/** Cuánto se queda el check en pantalla antes de cerrar solo. */
const EXITO_MS = 1300;

/** Confirmación de un alta o ingreso de stock: resumen de lo que se va a
 * cargar y un solo botón primario. Es el espejo no destructivo de
 * `ConfirmDialog` -- se monta como hermano del dialog del formulario (mismo
 * overlay, pinta encima por orden de DOM).
 *
 * Cuando el padre confirma que se guardó (`exito`), el contenido se
 * transforma en un check animado y, pasado `EXITO_MS`, llama a
 * `onExitoTerminado` para que el padre cierre todo. Mientras tanto no se
 * puede cerrar a mano (Esc / click fuera). */
export function ConfirmarAltaDialog({
  open,
  onClose,
  onConfirm,
  title,
  pregunta,
  filas,
  confirmLabel = "Confirmar",
  pending,
  exito,
  exitoLabel = "¡Agregado al stock!",
  onExitoTerminado,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  pregunta: string;
  filas: FilaResumen[];
  confirmLabel?: string;
  pending?: boolean;
  exito?: boolean;
  exitoLabel?: string;
  onExitoTerminado?: () => void;
}) {
  useEffect(() => {
    if (!exito) return;
    const t = setTimeout(() => onExitoTerminado?.(), EXITO_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exito]);

  return (
    <Dialog
      open={open}
      onClose={exito ? () => {} : onClose}
      title={exito ? "Ingreso confirmado" : title}
      footer={
        exito ? undefined : (
          <>
            <Button variant="outline" onClick={onClose} fullOnMobile>
              Volver
            </Button>
            <Button variant="primary" loading={pending} onClick={onConfirm} fullOnMobile>
              {pending ? "Guardando…" : confirmLabel}
            </Button>
          </>
        )
      }
    >
      {exito ? (
        <div
          className="flex flex-col items-center gap-3 py-6 text-center"
          role="status"
        >
          <div className="animate-celebrate-check flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30">
            <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" aria-hidden>
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
          <p className="text-lg font-semibold text-neutral-900">{exitoLabel}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <PackagePlus className="h-5 w-5" aria-hidden />
            </span>
            <p className="pt-2 text-sm text-neutral-700">{pregunta}</p>
          </div>
          <dl className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white/70">
            {filas.map((f) => (
              <div key={f.label} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  {f.label}
                </dt>
                <dd className="text-right font-medium tabular-nums text-neutral-900">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Dialog>
  );
}
