"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, Plus, Search } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { VarianteDialog } from "@/components/inventario/variante-dialog";
import { useOutsideClick } from "@/components/ui/use-outside-click";
import {
  agruparPorGrupo,
  nombreVariante,
  ordenarGrupos,
  stockDeVariante,
  type UnidadDeVariante,
} from "@/lib/variantes";
import { cn } from "@/lib/utils";
import type { Variante, VarianteCategoria } from "@/lib/types";

/** Selector de variante en dos pasos (grupo → variante), con alta de grupo y
 * de variante sin salir del formulario. No lista desactivadas. */
export function SelectorVariante({
  categoria = "celular",
  variantes,
  unidades = [],
  value,
  onChange,
  sugeridaId,
  disabled = false,
  onVarianteCreada,
}: {
  /** Solo se listan (y se crean) variantes de esta categoría. */
  categoria?: VarianteCategoria;
  variantes: Variante[];
  /** Para mostrar el stock disponible en las opciones. */
  unidades?: UnidadDeVariante[];
  value: string | null;
  onChange: (variante: Variante | null) => void;
  /** Filas de importación: se marca la que coincide con los datos. */
  sugeridaId?: string;
  disabled?: boolean;
  onVarianteCreada?: (variante: Variante) => void;
}) {
  const [creadas, setCreadas] = useState<Variante[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [grupo, setGrupo] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [activo, setActivo] = useState(0);
  const [nuevoGrupo, setNuevoGrupo] = useState<string | null>(null);
  const [creando, setCreando] = useState<{
    grupo: string;
    inicial?: Partial<
      Pick<Variante, "modelo" | "almacenamiento" | "condicion" | "color" | "memoria">
    >;
  } | null>(null);
  const ref = useOutsideClick<HTMLDivElement>(() => {
    setAbierto(false);
    setNuevoGrupo(null);
  });

  const todas = useMemo(() => {
    const mapa = new Map(variantes.map((v) => [v.id, v]));
    for (const v of creadas) mapa.set(v.id, v);
    return Array.from(mapa.values()).filter((v) => v.categoria === categoria);
  }, [variantes, creadas, categoria]);
  const activas = useMemo(() => todas.filter((v) => v.activa), [todas]);
  // La elegida puede estar desactivada (unidad vieja): igual se muestra, para
  // que el formulario no parezca vacío.
  const elegida = todas.find((v) => v.id === value) ?? null;
  const grupos = useMemo(() => ordenarGrupos(agruparPorGrupo(activas)), [activas]);

  const needle = busqueda.trim().toLowerCase();
  const gruposFiltrados = needle
    ? grupos.filter(
        (g) =>
          g.grupo.toLowerCase().includes(needle) ||
          g.variantes.some((v) => v.sku.toLowerCase().includes(needle)),
      )
    : grupos;
  const variantesDelGrupo = grupo
    ? (grupos.find((g) => g.clave === grupo)?.variantes ?? []).filter(
        (v) =>
          !needle ||
          v.sku.toLowerCase().includes(needle) ||
          nombreVariante(v).toLowerCase().includes(needle),
      )
    : [];

  function elegir(variante: Variante) {
    onChange(variante);
    setAbierto(false);
    setBusqueda("");
    setGrupo(null);
    setNuevoGrupo(null);
  }

  function abrir() {
    setAbierto(true);
    setGrupo(null);
    setBusqueda("");
    setActivo(0);
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    const lista = grupo ? variantesDelGrupo : gruposFiltrados;
    if (e.key === "Escape") {
      setAbierto(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (lista.length === 0) return;
      setActivo((i) =>
        e.key === "ArrowDown" ? (i + 1) % lista.length : (i - 1 + lista.length) % lista.length,
      );
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (grupo) {
        const variante = variantesDelGrupo[activo];
        if (variante) elegir(variante);
      } else {
        const g = gruposFiltrados[activo];
        if (g) {
          setGrupo(g.clave);
          setBusqueda("");
          setActivo(0);
        }
      }
    }
  }

  if (elegida) {
    const stock = stockDeVariante(elegida, unidades);
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-900">
            <span className="font-mono text-xs text-accent">{elegida.sku}</span> ·{" "}
            {nombreVariante(elegida, { cualquierColor: true })}
          </p>
          <p className="text-[11px] text-neutral-500">
            {stock.disponibles} disponible{stock.disponibles === 1 ? "" : "s"} ·{" "}
            {elegida.grupo}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={abrir} disabled={disabled}>
          Cambiar
        </Button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <Input
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setActivo(0);
          }}
          onFocus={abrir}
          onClick={() => !abierto && abrir()}
          onKeyDown={alTeclear}
          disabled={disabled}
          placeholder={grupo ? "Buscar variante (SKU o datos)…" : "Buscar grupo o variante…"}
          aria-label="Elegir variante"
          className="pl-9"
        />
      </div>

      {abierto && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
          {grupo ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setGrupo(null);
                  setBusqueda("");
                }}
                className="flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-xs text-neutral-500 hover:bg-neutral-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Grupos
              </button>
              {variantesDelGrupo.map((v, i) => {
                const stock = stockDeVariante(v, unidades);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onMouseEnter={() => setActivo(i)}
                    onClick={() => elegir(v)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm",
                      i === activo ? "bg-accent-soft" : "hover:bg-neutral-50",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-xs text-accent">{v.sku}</span>
                      <span className="block truncate text-xs text-neutral-600">
                        {nombreVariante(v, { cualquierColor: true })}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-[11px] text-neutral-500">
                      {v.id === sugeridaId && (
                        <span className="rounded-md bg-accent-soft px-1.5 py-0.5 font-medium text-accent">
                          Sugerida
                        </span>
                      )}
                      {stock.disponibles} disp.
                      {v.id === value && <Check className="h-3.5 w-3.5 text-accent" />}
                    </span>
                  </button>
                );
              })}
              {variantesDelGrupo.length === 0 && (
                <p className="px-2 py-2 text-center text-xs text-neutral-500">Sin variantes.</p>
              )}
              <button
                type="button"
                onClick={() => {
                  const g = grupos.find((x) => x.clave === grupo);
                  setCreando({ grupo: g?.grupo ?? "", inicial: { modelo: g?.grupo ?? "" } });
                  setAbierto(false);
                }}
                className="mt-1 flex w-full items-center gap-1.5 rounded-lg border-t border-neutral-100 px-2 py-2 text-left text-xs font-medium text-accent hover:bg-accent-soft"
              >
                <Plus className="h-3.5 w-3.5" /> Nueva variante en este grupo
              </button>
            </>
          ) : (
            <>
              {gruposFiltrados.map((g, i) => (
                <button
                  key={g.clave}
                  type="button"
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => {
                    setGrupo(g.clave);
                    setBusqueda("");
                    setActivo(0);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm",
                    i === activo ? "bg-accent-soft" : "hover:bg-neutral-50",
                  )}
                >
                  <span className="truncate text-neutral-800">{g.grupo}</span>
                  <span className="shrink-0 text-[11px] text-neutral-500">
                    {g.variantes.length} variante{g.variantes.length === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
              {gruposFiltrados.length === 0 && needle && (
                <p className="px-2 py-2 text-center text-xs text-neutral-500">
                  No hay grupos que coincidan.
                </p>
              )}
              {nuevoGrupo === null ? (
                <button
                  type="button"
                  onClick={() => setNuevoGrupo(busqueda.trim())}
                  className="mt-1 flex w-full items-center gap-1.5 rounded-lg border-t border-neutral-100 px-2 py-2 text-left text-xs font-medium text-accent hover:bg-accent-soft"
                >
                  <Plus className="h-3.5 w-3.5" /> Nuevo grupo
                </button>
              ) : (
                <div className="mt-1 flex items-center gap-1.5 border-t border-neutral-100 px-1 pt-2">
                  <Input
                    autoFocus
                    value={nuevoGrupo}
                    onChange={(e) => setNuevoGrupo(e.target.value)}
                    placeholder="Nombre del grupo"
                    aria-label="Nombre del grupo nuevo"
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && nuevoGrupo.trim()) {
                        setCreando({ grupo: nuevoGrupo.trim(), inicial: { modelo: nuevoGrupo.trim() } });
                        setAbierto(false);
                        setNuevoGrupo(null);
                      }
                    }}
                  />
                  <IconButton
                    aria-label="Crear grupo"
                    icon={Plus}
                    size="sm"
                    variant="outline"
                    disabled={!nuevoGrupo.trim()}
                    onClick={() => {
                      setCreando({ grupo: nuevoGrupo.trim(), inicial: { modelo: nuevoGrupo.trim() } });
                      setAbierto(false);
                      setNuevoGrupo(null);
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {creando && (
        <VarianteDialog
          key={`nueva-${creando.grupo}`}
          open
          categoria={categoria}
          onClose={() => setCreando(null)}
          inicial={{ ...creando.inicial, grupo: creando.grupo }}
          grupos={grupos.map((g) => g.grupo)}
          skus={activas.map((v) => v.sku)}
          onSaved={(v) => {
            setCreadas((prev) => [...prev, v]);
            onVarianteCreada?.(v);
            elegir(v);
          }}
        />
      )}
    </div>
  );
}
