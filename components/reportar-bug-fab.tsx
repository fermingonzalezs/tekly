"use client";

import { useState, useTransition } from "react";
import { Bug } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { reportarBugAction } from "@/app/(app)/actions";

export function ReportarBugFab() {
  const [open, setOpen] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [pending, startTransition] = useTransition();

  function abrir() {
    setDescripcion("");
    setEnviado(false);
    setOpen(true);
  }

  function enviar() {
    startTransition(async () => {
      await reportarBugAction(descripcion);
      setEnviado(true);
    });
  }

  return (
    <>
      {/* El Dialog va como hermano del wrapper fixed z-40: anidado adentro
          quedaría atrapado en su stacking context y pintaría debajo de
          otros fixed z-50 (SimPanel, overlays de páginas). */}
      <div className="fixed bottom-6 left-6 z-40">
        <button
          onClick={abrir}
          className="flex h-11 items-center gap-2 rounded-full bg-[linear-gradient(180deg,#6a63d4,#4f49bd)] px-4 text-sm font-medium text-white shadow-lg transition-colors hover:bg-[linear-gradient(180deg,#5f58cc,#453fb0)] active:bg-[linear-gradient(180deg,#544dbe,#3b3799)]"
        >
          <Bug className="h-4 w-4" />
          Reportar un problema
        </button>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reportar un problema"
        description="Contanos qué pasó -- lo revisamos apenas nos llega."
        footer={
          enviado ? (
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" disabled={!descripcion.trim() || pending} onClick={enviar}>
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
          <Textarea
            rows={5}
            autoFocus
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="¿Qué esperabas que pasara y qué pasó en cambio?"
          />
        )}
      </Dialog>
    </>
  );
}
