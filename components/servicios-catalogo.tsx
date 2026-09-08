"use client";

import { useState } from "react";
import { Plus, Pencil, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { servicios as seed } from "@/lib/mock-data";
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
export function ServiciosCatalogo() {
  const [list, setList] = useState<Servicio[]>(seed);
  const [editing, setEditing] = useState<Servicio | null>(null);

  function save(s: Servicio) {
    setList((prev) =>
      s.id
        ? prev.map((x) => (x.id === s.id ? s : x))
        : [...prev, { ...s, id: `s-${Date.now()}` }],
    );
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-400">
          {list.length} servicios · precio y garantía
        </p>
        <Button size="sm" onClick={() => setEditing(blank)}>
          <Plus className="h-4 w-4" /> Nuevo servicio
        </Button>
      </div>

      <Card className="overflow-hidden">
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
      />
    </div>
  );
}

function ServicioDialog({
  servicio,
  onClose,
  onSave,
}: {
  servicio: Servicio | null;
  onClose: () => void;
  onSave: (s: Servicio) => void;
}) {
  const [draft, setDraft] = useState<Servicio>(servicio ?? blank);

  return (
    <Dialog
      open={!!servicio}
      onClose={onClose}
      title={servicio?.id ? "Editar servicio" : "Nuevo servicio"}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!draft.nombre.trim() || draft.precioUsd <= 0}
            onClick={() => onSave(draft)}
          >
            Guardar
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
