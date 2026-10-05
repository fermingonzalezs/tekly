"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Contador global de dialogs abiertos -- soporta dialog-sobre-dialog
// (ej. ConfirmDialog encima de un form ya abierto): cada uno bloquea el
// scroll al abrirse y lo desbloquea al cerrarse, pero solo el que lleva
// el contador a 0 restaura el overflow real, así el de abajo no se libera
// mientras el de arriba sigue abierto.
let openDialogs = 0;

export function lockScroll() {
  openDialogs += 1;
  if (openDialogs === 1) document.body.style.overflow = "hidden";
}

export function unlockScroll() {
  openDialogs = Math.max(0, openDialogs - 1);
  if (openDialogs === 0) document.body.style.overflow = "";
}

/** ¿Ya hay otro dialog abierto debajo? Se lee al abrir el de arriba para
 * decidir si su overlay blurre a de nuevo (un blur sobre otro blur se ve
 * sucio) -- ver `Dialog`. */
export function isNested(): boolean {
  return openDialogs > 0;
}

/** Re-estilado de campos dentro del modal: en el vidrio un `Input`/`Select`
 * blanco opaco se ve "pegado"; alto 42px, radio 14px y blanco al 70% para que
 * respire el fondo. Se aplica siempre al body. */
const CAMPOS_VIDRIO =
  "[&_input]:h-[42px] [&_select]:h-[42px] [&_textarea]:rounded-[14px] [&_input]:rounded-[14px] [&_select]:rounded-[14px] [&_input]:bg-white/70 [&_select]:bg-white/70 [&_textarea]:bg-white/70 [&_input]:border-white/80 [&_select]:border-white/80 [&_textarea]:border-white/80";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
}) {
  const titleId = useId();
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Se congela al abrir: si se abre un ConfirmDialog encima, el de abajo no
  // cambia su overlay.
  const [nested, setNested] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      setNested(isNested()); // ¿ya había uno abierto antes de este?
      return;
    }
    if (!rendered) return;
    setClosing(true);
    const t = setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, 200);
    return () => clearTimeout(t);
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    lockScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlockScroll();
    };
  }, [open, onClose]);

  if (!rendered || !mounted) return null;

  const denso = size === "xl" || size === "2xl" || size === "3xl" || size === "4xl";

  // Portal a <body>: el overlay y su blur cubren la ventana entera, sin
  // depender de un ancestro con transform/filter/stacking context propio.
  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 overflow-y-auto bg-neutral-900/[0.07]",
        nested ? "backdrop-blur-none" : "backdrop-blur-[2px]",
      )}
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            // Sin `overflow-hidden`: los dropdowns propios (`ClientePicker`,
            // buscadores de ítems) son `position: absolute` y no contribuyen a
            // la altura de la tarjeta -- con `overflow-hidden` la lista que
            // sobresale se recorta en vez de flotar sobre el modal. El redondeo
            // lo lleva cada borde por su cuenta (header arriba, footer/body
            // abajo).
            closing ? "animate-modal-out" : "animate-modal-in",
            "relative my-8 w-full rounded-2xl border border-accent/70 shadow-2xl backdrop-blur-2xl backdrop-saturate-200",
            // Los detalles y «Nueva venta» (tablas + mucho texto) van más
            // opacos para que el fondo no compita con el contenido denso.
            denso ? "bg-white/90" : "bg-white/80",
            size === "4xl"
              ? "max-w-6xl"
              : size === "3xl"
                ? "max-w-5xl"
                : size === "2xl"
              ? "max-w-4xl"
              : size === "xl"
                ? "max-w-3xl"
                : size === "lg"
                  ? "max-w-2xl"
                  : "max-w-md",
          )}
        >
          <div className="flex items-start justify-between gap-4 rounded-t-2xl border-b border-table-header bg-table-header px-4 py-4 text-white sm:px-5">
            <div className="min-w-0">
              <h2
                id={titleId}
                className="text-base font-semibold uppercase tracking-wide text-white"
              >
                {title}
              </h2>
              {description && (
                <>
                  <div className="mt-1.5 mb-1.5 h-px w-full bg-white/20" />
                  <p className="text-sm text-white/70">{description}</p>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div
            className={cn(
              "px-4 py-4 sm:px-5",
              CAMPOS_VIDRIO,
              !footer && "rounded-b-2xl",
            )}
          >
            {children}
          </div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-neutral-100/60 px-4 py-3.5 sm:px-5">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
