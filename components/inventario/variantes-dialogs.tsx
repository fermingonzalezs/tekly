"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { nombreVariante } from "@/lib/variantes";
import type { Variante, VarianteCategoria } from "@/lib/types";
import { renombrarGrupoAction, unirVariantesAction } from "@/app/(app)/inventario/actions";

/** Renombra el nombre del grupo en todas sus variantes (no toca modelo ni
 * datos clave). */
export function RenombrarGrupoDialog({
  open,
  grupo,
  categoria = "celular",
  onClose,
  onSaved,
}: {
  open: boolean;
  grupo: string;
  categoria?: VarianteCategoria;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nuevo, setNuevo] = useState(grupo);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await renombrarGrupoAction(grupo, nuevo, categoria);
      if (!res.ok) {
        setError(res.error ?? "No se pudo renombrar el grupo.");
        return;
      }
      onSaved();
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      formulario
      title="Renombrar grupo"
      description="Cambia el nombre en todas sus variantes; el modelo no se toca."
      footer={
        <>
          <Button onClick={onClose} variant="outline" fullOnMobile>
            Cancelar
          </Button>
          <Button loading={pending}
            onClick={guardar}
            disabled={pending || !nuevo.trim()}
            variant="primary"
            fullOnMobile
          >
            {pending ? "Guardando…" : "Renombrar"}
          </Button>
        </>
      }
    >
      <Field label="Nombre del grupo">
        <Input value={nuevo} onChange={(e) => setNuevo(e.target.value)} autoFocus />
      </Field>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </Dialog>
  );
}

/** Une la variante de origen con otra de destino: mueve sus unidades,
 * copiándoles los datos clave de destino (y el precio si la unidad no tiene
 * precio propio). Si el destino define color, pisa el de las unidades. */
export function UnirVariantesDialog({
  open,
  origen,
  variantes,
  celulares,
  onClose,
  onDone,
}: {
  open: boolean;
  origen: Variante | null;
  variantes: Variante[];
  /** Unidades (celulares o notebooks) -- solo para contar las que se mueven. */
  celulares: { varianteId: string; color: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [destinoId, setDestinoId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!origen) return null;

  const opciones = variantes
    .filter((v) => v.activa && v.id !== origen.id && v.categoria === origen.categoria)
    .sort((a, b) =>
      a.grupo === origen.grupo
        ? b.grupo === origen.grupo
          ? a.sku.localeCompare(b.sku)
          : -1
        : b.grupo === origen.grupo
          ? 1
          : a.grupo.localeCompare(b.grupo),
    );
  const destino = opciones.find((v) => v.id === destinoId) ?? null;
  const unidades = celulares.filter((u) => u.varianteId === origen.id);
  const coloresPisados =
    destino?.color
      ? unidades.filter((u) => u.color && u.color !== "—" && u.color !== destino.color).length
      : 0;

  function confirmar() {
    if (!destino) return;
    setError(null);
    startTransition(async () => {
      const res = await unirVariantesAction(origen!.id, destino.id);
      if (!res.ok) {
        setError(res.error ?? "No se pudieron unir las variantes.");
        return;
      }
      onDone();
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="2xl"
      formulario
      title="Unir variantes"
      description="Las unidades de esta variante pasan a la de destino y esta se elimina."
      footer={
        <>
          <Button onClick={onClose} variant="outline" fullOnMobile>
            Cancelar
          </Button>
          <Button loading={pending}
            onClick={confirmar}
            disabled={!destino || pending}
            variant="danger"
            fullOnMobile
          >
            {pending ? "Uniendo…" : "Unir variantes"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-[13px] text-neutral-700">
          <span className="font-mono text-xs text-accent">{origen.sku}</span> ·{" "}
          {nombreVariante(origen, { cualquierColor: true })} ·{" "}
          {unidades.length} unidad{unidades.length === 1 ? "" : "es"}
        </p>
        <Field label="Unir con">
          <Select value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
            <option value="">Elegí la variante de destino…</option>
            {opciones.map((v) => (
              <option key={v.id} value={v.id}>
                {v.sku} · {nombreVariante(v, { cualquierColor: true })} ({v.grupo})
              </option>
            ))}
          </Select>
        </Field>
        {destino && (
          <p className="rounded-lg bg-neutral-50 px-3 py-2 text-[13px] text-neutral-700">
            Se mueven <strong>{unidades.length}</strong> unidad
            {unidades.length === 1 ? "" : "es"} a{" "}
            <span className="font-mono text-xs">{destino.sku}</span>. Sus datos clave pasan a los de
            destino y las que no tengan precio propio toman su precio.
            {coloresPisados > 0 && (
              <>
                {" "}
                <strong className="text-amber-700">
                  Se les pisa el color a {coloresPisados} unidad
                  {coloresPisados === 1 ? "" : "es"}.
                </strong>
              </>
            )}
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}
