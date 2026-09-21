"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { fmtUsd } from "@/lib/format";
import type { Servicio } from "@/lib/types";

const blank: Servicio = {
  id: "",
  nombre: "",
  precioUsd: 0,
  garantiaDias: 90,
  activo: true,
};

/** Catálogo editable de servicios de reparación. Vive dentro de Reparaciones. */
export function ServiciosCatalogo({
  initialServicios,
  onSave,
}: {
  initialServicios: Servicio[];
  onSave: (s: Servicio) => Promise<Servicio>;
}) {
  const [list, setList] = useState<Servicio[]>(initialServicios);
  const [editing, setEditing] = useState<Servicio | null>(null);
  const [pending, startTransition] = useTransition();

  function save(s: Servicio) {
    startTransition(async () => {
      const guardado = await onSave(s);
      setList((prev) =>
        s.id
          ? prev.map((x) => (x.id === guardado.id ? guardado : x))
          : [...prev, guardado],
      );
      setEditing(null);
    });
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setEditing(blank)}
        className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft md:w-auto"
      >
        <Plus className="h-4 w-4" />
        Nuevo servicio
      </button>

      <div className="space-y-2 md:hidden">
        {list.map((s) => (
          <Card key={s.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-medium text-neutral-900">
                {s.nombre}
              </p>
              <p className="shrink-0 text-sm font-semibold tabular-nums">
                {fmtUsd(s.precioUsd)}
              </p>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2 text-xs text-neutral-500">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-neutral-400" />
                {s.garantiaDias === 0 ? "Sin garantía" : `${s.garantiaDias} días`}
              </span>
              <button
                onClick={() => setEditing(s)}
                className="inline-flex items-center gap-1 font-medium text-neutral-400 hover:text-accent"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
              <Badge tone={s.activo ? "green" : "gray"}>
                {s.activo ? "Activo" : "Inactivo"}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
      <Card className="hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs text-neutral-400">
              <th className="px-5 py-3">Servicio</th>
              <th className="px-5 py-3">Precio</th>
              <th className="px-5 py-3">Garantía</th>
              <th className="px-5 py-3">Estado</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr
                key={s.id}
                className="border-t border-neutral-100 first:border-t-0"
              >
                <td className="px-5 py-3 font-medium">{s.nombre}</td>
                <td className="px-5 py-3 font-semibold">{fmtUsd(s.precioUsd)}</td>
                <td className="px-5 py-3 text-neutral-500">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-neutral-400" />
                    {s.garantiaDias === 0
                      ? "Sin garantía"
                      : `${s.garantiaDias} días`}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={s.activo ? "green" : "gray"}>
                    {s.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => setEditing(s)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-accent"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ServicioDialog
        key={editing?.id || "new"}
        servicio={editing}
        onClose={() => setEditing(null)}
        onSave={save}
        pending={pending}
      />
    </div>
  );
}

function ServicioDialog({
  servicio,
  onClose,
  onSave,
  pending,
}: {
  servicio: Servicio | null;
  onClose: () => void;
  onSave: (s: Servicio) => void;
  pending: boolean;
}) {
  const [draft, setDraft] = useState<Servicio>(servicio ?? blank);

  return (
    <Dialog
      open={!!servicio}
      onClose={onClose}
      title={servicio?.id ? "Editar servicio" : "Nuevo servicio"}
      footer={
        <>
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="w-full sm:w-auto"
            disabled={!draft.nombre.trim() || draft.precioUsd <= 0 || pending}
            onClick={() => onSave(draft)}
          >
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nombre">
          <Input
            value={draft.nombre}
            onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
            placeholder="Cambio de pantalla"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio (U$)">
            <Input
              type="number"
              min={0}
              value={draft.precioUsd || ""}
              onChange={(e) =>
                setDraft({ ...draft, precioUsd: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label="Garantía (días)">
            <Input
              type="number"
              min={0}
              value={draft.garantiaDias}
              onChange={(e) =>
                setDraft({ ...draft, garantiaDias: Number(e.target.value) || 0 })
              }
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={draft.activo}
            onChange={(e) => setDraft({ ...draft, activo: e.target.checked })}
            className="h-4 w-4 rounded border-neutral-300 text-accent"
          />
          Servicio activo (visible al cargar tickets)
        </label>
      </div>
    </Dialog>
  );
}
