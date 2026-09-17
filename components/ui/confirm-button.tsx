"use client";

import { useState } from "react";
import { Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Botón de "Eliminar" que al tocarlo se convierte en "¿Seguro? [Sí] [No]"
 * en el mismo lugar, en vez de abrir un dialog de confirmación aparte --
 * evita dialog-sobre-dialog cuando la acción vive dentro de un detalle ya
 * abierto (ficha de venta, turno, etc). Estilo rojo/destructivo a propósito,
 * separado de la familia violeta/blanca de cada sección: una acción
 * destructiva es su propia categoría, no una alternativa al botón primario. */
export function ConfirmButton({
  onConfirm,
  label = "Eliminar",
  variant = "pill",
  className,
  disabled,
}: {
  onConfirm: () => void;
  label?: string;
  variant?: "pill" | "icon";
  className?: string;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  const confirmUi = (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      <span className="whitespace-nowrap text-[11px] font-medium text-neutral-500">
        ¿Seguro?
      </span>
      <button
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
        className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-red-600 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-red-700"
      >
        <Check className="h-3 w-3" /> Sí
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );

  if (variant === "icon") {
    return (
      <span className="relative inline-flex shrink-0">
        {confirming && (
          <span className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white py-1 pl-2 shadow-[0_0_0_6px_white]">
            {confirmUi}
          </span>
        )}
        <button
          onClick={() => setConfirming(true)}
          disabled={disabled}
          title={label}
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-40",
            confirming && "invisible",
            className,
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  if (confirming) return confirmUi;

  return (
    <button
      onClick={() => setConfirming(true)}
      disabled={disabled}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-red-200 px-4 text-sm font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      <Trash2 className="h-4 w-4" /> {label}
    </button>
  );
}
