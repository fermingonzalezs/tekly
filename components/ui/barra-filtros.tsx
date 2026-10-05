"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Fila de filtros estándar de una sección con tabla (plan 009). Orden:
 * tabs de *vista de la misma entidad* → buscador → selects → chips de
 * filtros activos → acción primaria a la derecha. Los tabs quedan siempre
 * visibles; en mobile solo los selects se colapsan detrás del botón
 * "Filtros · N".
 */
export function BarraFiltros({
  tabs,
  busqueda,
  filtros,
  chips,
  accion,
  contadorFiltros = 0,
}: {
  /** Tabs de otra vista de los mismos datos (ej. Ventas / Ítems vendidos). */
  tabs?: React.ReactNode;
  /** Buscador (`w-64` en desktop). */
  busqueda?: React.ReactNode;
  /** Selects / inputs de filtro. */
  filtros?: React.ReactNode;
  /** Chips de filtros activos (fila propia debajo, opcional). */
  chips?: React.ReactNode;
  /** Acción primaria de la sección (a la derecha). */
  accion?: React.ReactNode;
  /** Cantidad que muestra el botón "Filtros · N" en mobile. */
  contadorFiltros?: number;
}) {
  const [open, setOpen] = useState(false);
  const hayColapsables = Boolean(filtros);

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        {tabs}
        {busqueda}

        {hayColapsables && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-900/10 px-3.5 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-900/20 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 md:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros{contadorFiltros > 0 ? ` · ${contadorFiltros}` : ""}
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}

        {hayColapsables && (
          <div
            className={cn(
              "flex-col gap-2 md:contents",
              open ? "flex" : "hidden",
            )}
          >
            {filtros}
          </div>
        )}

        {accion && (
          <div className="w-full shrink-0 md:ml-auto md:w-auto">{accion}</div>
        )}
      </div>

      {chips}
    </div>
  );
}
