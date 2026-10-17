"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { reportarBugAction } from "@/app/(app)/actions";

/** Diálogo de "Reportar un problema". El botón que lo abre vive en `FabDock`. */
export function ReportarBugFab({
  open,
  onOpenChange: setOpen,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const [accion, setAccion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Cada vez que se abre arranca limpio.
  useEffect(() => {
    if (!open) return;
    setAccion("");
    setDescripcion("");
    setEnviado(false);
    setError(null);
  }, [open]);

  function enviar() {
    startTransition(async () => {
      const r = await reportarBugAction(descripcion, accion);
      if (r.error) {
        setError(r.error);
        return;
      }
      setEnviado(true);
    });
  }

  const valido = accion.trim() && descripcion.trim();

  return (
    <>
      {/* Mismo sistema de botones y de modal de vidrio que el resto
          (ver "Dialog" en CLAUDE.md). */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reportar un problema"
        description="Contanos qué pasó -- lo revisamos apenas nos llega."
        footer={
          enviado ? (
            <Button
              onClick={() => setOpen(false)}
              variant="outline"
            >
              Cerrar
            </Button>
          ) : (
            <>
              <Button
                onClick={() => setOpen(false)}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                disabled={!valido || pending}
                onClick={enviar}
                variant="primary"
              >
                {pending ? "Enviando…" : "Enviar reporte"}
              </Button>
            </>
          )
        }
      >
        {enviado ? (
          <p className="py-4 text-center text-sm text-neutral-600">
            Gracias, ya lo tenemos anotado.
          </p>
        ) : (
          <div className="space-y-3">
            <Field label="Sección">
              <Input value={pathname ?? ""} disabled />
            </Field>
            <Field label="¿Qué estabas haciendo?">
              <Input
                autoFocus
                value={accion}
                onChange={(e) => setAccion(e.target.value)}
                placeholder="Ej. Cargando una venta nueva"
              />
            </Field>
            <Field label="¿Qué pasó?">
              <Textarea
                rows={4}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="¿Qué esperabas que pasara y qué pasó en cambio?"
              />
            </Field>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}
      </Dialog>
    </>
  );
}
