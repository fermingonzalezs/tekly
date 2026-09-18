"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Contador global de dialogs abiertos -- soporta dialog-sobre-dialog
// (ej. ConfirmDialog encima de un form ya abierto): cada uno bloquea el
// scroll al abrirse y lo desbloquea al cerrarse, pero solo el que lleva
// el contador a 0 restaura el overflow real, así el de abajo no se libera
// mientras el de arriba sigue abierto.
let openDialogs = 0;

function lockScroll() {
  openDialogs += 1;
  if (openDialogs === 1) document.body.style.overflow = "hidden";
}

function unlockScroll() {
  openDialogs = Math.max(0, openDialogs - 1);
  if (openDialogs === 0) document.body.style.overflow = "";
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  accent = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
  accent?: boolean;
}) {
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "animate-toast-in relative my-8 w-full overflow-hidden rounded-2xl border bg-white shadow-2xl",
            accent ? "border-accent" : "border-neutral-200",
            size === "lg" ? "max-w-2xl" : "max-w-md",
          )}
        >
          <div
            className={cn(
              "flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-5",
              accent
                ? "border-[#352f86] bg-[#352f86] text-white"
                : "border-neutral-100",
            )}
          >
            <div>
              <h2
                className={cn(
                  "text-base font-semibold uppercase tracking-wide",
                  accent ? "text-white" : "text-neutral-900",
                )}
              >
                {title}
              </h2>
              {accent && description && (
                <div className="mt-1.5 mb-1.5 h-px w-full bg-white/20" />
              )}
              {description && (
                <p
                  className={cn(
                    "text-sm",
                    accent ? "text-white/70" : "mt-0.5 text-neutral-400",
                  )}
                >
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                accent
                  ? "text-white/70 hover:bg-white/10 hover:text-white"
                  : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600",
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-4 py-4 sm:px-5">{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 px-4 py-3.5 sm:px-5">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
