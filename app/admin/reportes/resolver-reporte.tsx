"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { reabrirReporteAction, resolverReporteAction } from "./actions";

/** Acción de la fila de `/admin/reportes`: «Resolver» abre un diálogo para
 * contar qué se arregló (eso es lo que le llega al usuario en la campanita).
 * En un reporte ya resuelto: «Editar respuesta» (le vuelve a aparecer como
 * nueva) y «Reabrir». */
export function ResolverReporte({
  id,
  descripcion,
  usuario,
  resuelto,
  respuesta,
}: {
  id: string;
  descripcion: string;
  usuario: string;
  resuelto: boolean;
  respuesta: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState(respuesta ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await resolverReporteAction(id, texto);
      if (res.error) {
        setError(res.error);
        return;
      }
      setAbierto(false);
    });
  }

  function reabrir() {
    startTransition(async () => {
      await reabrirReporteAction(id);
    });
  }

  return (
    <>
      {resuelto ? (
        <div className="flex flex-col items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            icon={Pencil}
            onClick={() => {
              setTexto(respuesta ?? "");
              setAbierto(true);
            }}
          >
            Editar respuesta
          </Button>
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={reabrir} loading={pending}>
            Reabrir
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="tonal" icon={CheckCircle2} onClick={() => setAbierto(true)}>
          Resolver
        </Button>
      )}

      <Dialog
        key={abierto ? `resolver-${id}` : `resolver-none-${id}`}
        open={abierto}
        onClose={() => setAbierto(false)}
        size="lg"
        formulario
        title={resuelto ? "Editar respuesta" : "Marcar como resuelto"}
        description={`A ${usuario} le llega esta respuesta en sus notificaciones.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setAbierto(false)} fullOnMobile>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={guardar}
              loading={pending}
              disabled={!texto.trim()}
              fullOnMobile
            >
              {resuelto ? "Guardar y avisar de nuevo" : "Resolver y avisar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Reportó
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{descripcion}</p>
          </div>
          <Field label="¿Qué se arregló?">
            <Textarea
              autoFocus
              rows={4}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ej. Ya podés elegir el medio de cobro al editar una venta."
            />
          </Field>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </Dialog>
    </>
  );
}
