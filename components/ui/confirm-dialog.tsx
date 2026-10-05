"use client";

import { Button } from "@/components/ui/button";
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
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" loading={pending} onClick={onConfirm}>
            {pending ? "Eliminando…" : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-neutral-500">{children}</div>
    </Dialog>
  );
}
