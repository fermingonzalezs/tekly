"use client";

import { Button } from "@/components/ui/button";
import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Bug } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { reportarBugAction } from "@/app/(app)/actions";

export function ReportarBugFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [accion, setAccion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [pending, startTransition] = useTransition();

  function abrir() {
    setAccion("");
    setDescripcion("");
    setEnviado(false);
    setOpen(true);
  }

  function enviar() {
    startTransition(async () => {
      await reportarBugAction(descripcion, accion);
      setEnviado(true);
    });
  }

  const valido = accion.trim() && descripcion.trim();

  return (
    <>
      {/* El Dialog va como hermano del wrapper fixed z-40: anidado adentro
          quedaría atrapado en su stacking context y pintaría debajo de
          otros fixed z-50 de la app (Dialogs, overlays de páginas). Lado
          izquierdo (el FAB de "+" de la command palette queda del derecho),
          chico y solo ícono. Color fijo (rojo claro, no el `accent` de la
          organización) a propósito -- "reportar un problema" tiene que
          distinguirse del resto sin importar la paleta elegida. Oculto en
          mobile: a ese tamaño de pantalla compite demasiado con el resto de
          los controles fixed (nav, toasts). */}
      <div className="fixed bottom-6 left-6 z-40 hidden md:block">
        <Button
          onClick={abrir}
          aria-label="Reportar un problema"
          title="Reportar un problema"
          variant="danger"
        >
          <Bug className="h-4 w-4" />
        </Button>
      </div>

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
          </div>
        )}
      </Dialog>
    </>
  );
}
