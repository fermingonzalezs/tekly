"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, GrillaCampos, Input, Select } from "@/components/ui/field";
import { CONDICIONES_CELULAR } from "@/lib/status";
import { skuSugerido } from "@/lib/variantes";
import type { Variante, VarianteCategoria } from "@/lib/types";
import { createVarianteAction, updateVarianteAction } from "@/app/(app)/inventario/actions";

/** Alta/edición de una variante (SKU). El SKU se sugiere con `skuSugerido`
 * mientras el usuario no lo toque. Se usa desde el selector (alta manual,
 * importación, canje) y desde la vista agrupada. */
export function VarianteDialog({
  open,
  onClose,
  variante,
  categoria: categoriaProp = "celular",
  inicial,
  grupos,
  skus,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** null/undefined = alta. */
  variante?: Variante | null;
  /** Para el alta (al editar manda la de la variante). Default celular. */
  categoria?: VarianteCategoria;
  /** Precarga de grupo/datos clave (selector, fila de importación, canje). */
  inicial?: Partial<
    Pick<Variante, "grupo" | "modelo" | "almacenamiento" | "condicion" | "color" | "memoria">
  >;
  grupos: string[];
  /** SKUs ya usados, para desambiguar la sugerencia. */
  skus: string[];
  onSaved: (variante: Variante) => void;
}) {
  const editando = !!variante;
  const categoria = variante?.categoria ?? categoriaProp;
  const esNotebook = categoria === "notebook";
  const [grupo, setGrupo] = useState(variante?.grupo ?? inicial?.grupo ?? "");
  const [modelo, setModelo] = useState(variante?.modelo ?? inicial?.modelo ?? "");
  const [almacenamiento, setAlmacenamiento] = useState(
    variante?.almacenamiento ?? inicial?.almacenamiento ?? (esNotebook ? "512GB" : "128GB"),
  );
  const [memoria, setMemoria] = useState(
    variante?.memoria ?? inicial?.memoria ?? (esNotebook ? "16GB" : ""),
  );
  const [condicion, setCondicion] = useState(
    normalizarCondicion(variante?.condicion ?? inicial?.condicion, esNotebook),
  );
  const [color, setColor] = useState(variante?.color ?? inicial?.color ?? "");
  const [sku, setSku] = useState(variante?.sku ?? "");
  // Al editar se conserva el SKU existente salvo que el usuario lo cambie.
  const [skuTocado, setSkuTocado] = useState(!!variante);
  const [precioUsd, setPrecioUsd] = useState(variante?.precioUsd ?? 0);
  // Texto para que vacío = «sin precio mayorista» (no 0).
  const [mayorista, setMayorista] = useState(
    variante?.precioMayoristaUsd != null ? String(variante.precioMayoristaUsd) : "",
  );
  const [stockMinimo, setStockMinimo] = useState(variante?.stockMinimo ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const datos = { categoria, modelo, memoria, almacenamiento, condicion, color };
  const sugerido = skuSugerido(
    datos,
    skus.filter((s) => s !== variante?.sku),
  );
  const skuEfectivo = skuTocado ? sku : sugerido;

  const valido =
    grupo.trim() !== "" &&
    modelo.trim() !== "" &&
    condicion.trim() !== "" &&
    skuEfectivo.trim() !== "";

  function guardar() {
    setError(null);
    startTransition(async () => {
      const payload = {
        categoria,
        memoria: esNotebook ? memoria.trim() : "",
        grupo: grupo.trim(),
        sku: skuEfectivo.trim(),
        modelo: modelo.trim(),
        almacenamiento: almacenamiento.trim(),
        condicion: condicion.trim(),
        color: esNotebook ? "" : color.trim(),
        precioUsd,
        precioMayoristaUsd: mayorista.trim() === "" ? null : Number(mayorista) || 0,
        stockMinimo,
      };
      const res = editando
        ? await updateVarianteAction(variante!.id, payload)
        : await createVarianteAction(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved(res.variante);
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="3xl"
      formulario
      title={editando ? "Editar variante" : "Nueva variante"}
      description={
        editando
          ? "Los datos clave se copian a sus equipos no vendidos."
          : esNotebook
            ? "El SKU es obligatorio y único; modelo, memoria, almacenamiento y condición definen a qué notebooks aplica."
            : "El SKU es obligatorio y único; el resto define a qué equipos aplica."
      }
      footer={
        <>
          <Button onClick={onClose} variant="outline" fullOnMobile>
            Cancelar
          </Button>
          <Button loading={pending}
            onClick={guardar}
            disabled={!valido || pending}
            variant="primary"
            fullOnMobile
          >
            {pending ? "Guardando…" : editando ? "Guardar" : "Crear variante"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <GrillaCampos>
          <Field label="Grupo">
            <Input
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              list="variante-grupos"
              placeholder={esNotebook ? "MacBook Air" : "iPhone 15"}
            />
            <datalist id="variante-grupos">
              {grupos.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Field>
          <Field label="Modelo">
            <Input
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder={esNotebook ? "MacBook Air M2 13\"" : "iPhone 15 Pro"}
            />
          </Field>
          {esNotebook && (
            <Field label="Memoria (RAM)">
              <Input
                value={memoria}
                onChange={(e) => setMemoria(e.target.value)}
                placeholder="16 GB"
              />
            </Field>
          )}
          <Field label="Almacenamiento">
            <Input
              value={almacenamiento}
              onChange={(e) => setAlmacenamiento(e.target.value)}
              placeholder={esNotebook ? "512 GB" : "128 GB"}
            />
          </Field>
          <Field label="Condición">
            <Select value={condicion} onChange={(e) => setCondicion(e.target.value)}>
              {esNotebook ? (
                <>
                  <option value="nuevo">Nuevo</option>
                  <option value="usado">Usado</option>
                </>
              ) : (
                CONDICIONES_CELULAR.map((c) => <option key={c}>{c}</option>)
              )}
            </Select>
          </Field>
          {!esNotebook && (
            <Field label="Color (opcional)">
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Vacío = cualquier color"
              />
            </Field>
          )}
          <Field label="SKU">
            <Input
              value={skuEfectivo}
              onChange={(e) => {
                setSkuTocado(true);
                setSku(e.target.value.toUpperCase());
              }}
              className="font-mono"
            />
          </Field>
          <Field label="Precio (U$)">
            <Input
              type="number"
              min={0}
              value={precioUsd || ""}
              onChange={(e) => setPrecioUsd(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Precio mayorista (U$)">
            <Input
              type="number"
              min={0}
              value={mayorista}
              placeholder="Opcional"
              onChange={(e) => setMayorista(e.target.value)}
            />
          </Field>
          <Field label="Stock mínimo">
            <Input
              type="number"
              min={0}
              value={stockMinimo || ""}
              onChange={(e) => setStockMinimo(Number(e.target.value) || 0)}
            />
          </Field>
        </GrillaCampos>
        <p className="text-xs text-neutral-500">
          {esNotebook
            ? "Cada notebook carga su color, CPU, pantalla y serie. Stock mínimo 0 = sin aviso."
            : "Vacío en color = la variante sirve para cualquier color y cada equipo carga el suyo. Stock mínimo 0 = sin aviso."}{" "}
          El precio mayorista es el que toma cada equipo en una venta mayorista, salvo que el equipo tenga uno propio.
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}

/** Condición inicial válida para el select: notebooks `nuevo`/`usado`
 * (default `usado`); celulares un grado (default `A`). */
function normalizarCondicion(condicion: string | undefined, esNotebook: boolean): string {
  const c = (condicion ?? "").trim();
  if (esNotebook) return c.toLowerCase() === "nuevo" ? "nuevo" : "usado";
  return c || "A";
}
