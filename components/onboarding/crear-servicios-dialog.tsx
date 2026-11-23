"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useVolverAlOnboarding } from "@/components/onboarding/volver-al-onboarding";
import type { Servicio } from "@/lib/types";

type Fila = { nombre: string; precioUsd: string; garantiaDias: string };
const filaVacia = (): Fila => ({ nombre: "", precioUsd: "", garantiaDias: "90" });

/** Alta de varios servicios del catálogo de una (paso "Cargá tu catálogo de
 * servicios" del checklist de Bienvenida): una fila por servicio, se guardan
 * todos juntos y recién ahí vuelve a los primeros pasos. Los que se guardaron
 * salen de la lista, así un error a mitad de camino no los duplica. */
export function CrearServiciosDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (s: Servicio) => Promise<Servicio>;
}) {
  const [filas, setFilas] = useState<Fila[]>([filaVacia()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const volverAlOnboarding = useVolverAlOnboarding();
  const completas = filas.filter((f) => f.nombre.trim());

  const cambiar = (i: number, patch: Partial<Fila>) =>
    setFilas((prev) => prev.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  const submit = () => {
    setError(null);
    startTransition(async () => {
      let pendientes = completas;
      try {
        for (const fila of completas) {
          await onSave({
            id: "",
            nombre: fila.nombre.trim(),
            precioUsd: Number(fila.precioUsd) || 0,
            garantiaDias: Number(fila.garantiaDias) || 0,
            activo: true,
          });
          pendientes = pendientes.slice(1);
        }
      } catch {
        setFilas(pendientes);
        setError("No se pudieron guardar todos los servicios. Los que quedan en la lista no se guardaron.");
        return;
      }
      if (!(await volverAlOnboarding())) onClose();
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Cargar servicios"
      description="Las reparaciones que hacés seguido, con su precio y garantía."
      size="xl"
      formulario
      footer={
        <>
          <Button onClick={onClose} variant="outline" fullOnMobile disabled={pending}>
            Cancelar
          </Button>
          <Button
            disabled={completas.length === 0}
            loading={pending}
            onClick={submit}
            variant="primary"
            fullOnMobile
          >
            {pending
              ? "Guardando…"
              : `Guardar ${completas.length} ${completas.length === 1 ? "servicio" : "servicios"}`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {filas.map((fila, i) => (
          <div
            key={i}
            className="grid grid-cols-1 items-end gap-3 rounded-lg border border-neutral-200 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
          >
            <Field label={`Servicio ${i + 1}`}>
              <Input
                value={fila.nombre}
                onChange={(e) => cambiar(i, { nombre: e.target.value })}
                placeholder={i === 0 ? "Cambio de pantalla" : "Nombre del servicio"}
                autoFocus={i === filas.length - 1}
              />
            </Field>
            <Field label="Precio (U$)">
              <Input
                type="number"
                min={0}
                value={fila.precioUsd}
                onChange={(e) => cambiar(i, { precioUsd: e.target.value })}
              />
            </Field>
            <Field label="Garantía (días)">
              <Input
                type="number"
                min={0}
                value={fila.garantiaDias}
                onChange={(e) => cambiar(i, { garantiaDias: e.target.value })}
              />
            </Field>
            <IconButton
              aria-label={`Quitar servicio ${i + 1}`}
              icon={Trash2}
              variant="danger-ghost"
              disabled={filas.length === 1}
              onClick={() => setFilas((prev) => prev.filter((_, j) => j !== i))}
            />
          </div>
        ))}
        <Button variant="tonal" icon={Plus} onClick={() => setFilas((prev) => [...prev, filaVacia()])}>
          Agregar otro servicio
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}
