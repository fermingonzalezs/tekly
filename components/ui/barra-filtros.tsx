"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Barra de filtros estándar de una sección con tabla (plan 009). Va siempre
 * dentro de un **panel con borde** (mismo lenguaje que la `Card` de la
 * tabla: blanco, `rounded-2xl`, borde y sombra suave) para que no quede
 * «flotando» sobre el fondo:
 *
 * - Con `tabs`: dos filas. Arriba los tabs (categorías / vistas) con la
 *   acción a la derecha; una línea divisoria y abajo, sobre un fondo gris
 *   muy suave, buscador → selects. Sin buscador ni filtros, solo la fila de
 *   arriba.
 * - Sin `tabs`: una sola fila (buscador → selects → acción a la derecha).
 *
 * Los chips de filtros activos van debajo, fuera del panel. En mobile los
 * selects se colapsan detrás del botón "Filtros · N".
 */
export function BarraFiltros({
  tabs,
  busqueda,
  filtros,
  chips,
  accion,
  contadorFiltros = 0,
}: {
  /** Tabs de categoría / vista (ej. Celulares · Notebooks, Ventas / Ítems vendidos). */
  tabs?: React.ReactNode;
  /** Buscador (`w-64` en desktop). */
  busqueda?: React.ReactNode;
  /** Selects / inputs de filtro. */
  filtros?: React.ReactNode;
  /** Chips de filtros activos (fila propia debajo del panel, opcional). */
  chips?: React.ReactNode;
  /** Acción primaria de la sección (a la derecha). */
  accion?: React.ReactNode;
  /** Cantidad que muestra el botón "Filtros · N" en mobile. */
  contadorFiltros?: number;
}) {
  const [open, setOpen] = useState(false);
  const hayColapsables = Boolean(filtros);

  // Botón "Filtros · N" (solo mobile) + los selects, que en mobile se
  // pliegan detrás del botón y en desktop van en línea (`md:contents`).
  const colapsables = hayColapsables ? (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-900/10 bg-white px-3.5 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-900/20 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 md:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filtros{contadorFiltros > 0 ? ` · ${contadorFiltros}` : ""}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      <div className={cn("flex-col gap-2 md:contents", open ? "flex" : "hidden")}>
        {filtros}
      </div>
    </>
  ) : null;

  const fila = "flex flex-col gap-2 px-4 py-3 md:flex-row md:flex-wrap md:items-center";
  const accionDerecha = accion && (
    <div className="w-full shrink-0 md:ml-auto md:w-auto">{accion}</div>
  );
  const hayFilaFiltros = Boolean(busqueda) || hayColapsables;

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {tabs ? (
          <>
            <div className={fila}>
              {tabs}
              {accionDerecha}
            </div>
            {hayFilaFiltros && (
              <div className={cn(fila, "border-t border-neutral-200 bg-neutral-50/70")}>
                {busqueda}
                {colapsables}
              </div>
            )}
          </>
        ) : (
          <div className={fila}>
            {busqueda}
            {colapsables}
            {accionDerecha}
          </div>
        )}
      </div>
      {chips}
    </div>
  );
}
