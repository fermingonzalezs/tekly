"use client";

import { Dialog } from "@/components/ui/dialog";

/** Confirmación de una acción destructiva como modal propio -- el
 * "¿Eliminar X?" de toda la app. Se monta como hermano del dialog de
 * detalle/edición que lo abre (mismo overlay `fixed inset-0`, pinta encima
 * por orden de DOM). */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Eliminar",
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  pending?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            onClick={onClose}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-red-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
          >
            {pending ? "Eliminando…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-neutral-500">{children}</div>
    </Dialog>
  );
}
