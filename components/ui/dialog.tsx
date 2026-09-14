"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

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
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
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
              "flex items-start justify-between gap-4 border-b px-5 py-4",
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
          <div className="px-5 py-4">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-5 py-3.5">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
