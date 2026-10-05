"use client";

import { Eye, EyeOff } from "lucide-react";
import { useVisibilidadBloques } from "@/components/ui/use-visibilidad-bloques";
import { cn } from "@/lib/utils";
import type { BloqueVisible } from "@/lib/visibilidad-bloques";

const GRID_TARJETAS: Record<number, string> = {
  4: "grid-cols-2 gap-3 lg:grid-cols-4",
  5: "grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5",
  8: "grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8",
};

function BotonBloque({
  id,
  bloque,
  label,
  visible,
  onToggle,
}: {
  id: string;
  bloque: BloqueVisible;
  label: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={!visible}
      aria-controls={`${id}-${bloque}`}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-full border border-neutral-900/10 px-3.5 text-sm font-semibold transition-colors",
        "text-neutral-600 hover:border-neutral-900/20 hover:text-neutral-900",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1",
      )}
    >
      {visible ? (
        <EyeOff className="h-3.5 w-3.5" />
      ) : (
        <Eye className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}

/**
 * Layout estándar de una sección con tabla (plan 009). Renderiza, siempre en
 * este orden: tabs de página → barra de visibilidad → Gráficos → Tarjetas →
 * Filtros → tabla. Cada bloque (Gráficos, Tarjetas) es independiente: se
 * ocultar por separado y la tabla sube al desmontarse.
 */
export function SeccionTabla({
  id,
  tabs,
  graficos,
  tarjetas,
  columnasTarjetas = 4,
  filtros,
  children,
}: {
  /** Clave para persistir la visibilidad (`tekly:ui:<id>`). */
  id: string;
  /** Tabs que cambian de entidad: van arriba de los gráficos. */
  tabs?: React.ReactNode;
  /** Exactamente 2 gráficos (cada uno ya envuelto en `GraficoCard`). */
  graficos?: React.ReactNode;
  /** 4 `StatCard` por defecto (8 en Reparaciones, 5 en Cajas). */
  tarjetas?: React.ReactNode;
  columnasTarjetas?: 4 | 5 | 8;
  /** Fila de filtros (normalmente un `<BarraFiltros>`). */
  filtros?: React.ReactNode;
  /** La tabla. */
  children: React.ReactNode;
}) {
  const { graficos: verGraficos, tarjetas: verTarjetas, toggle } =
    useVisibilidadBloques(id);
  const hayGraficos = Boolean(graficos);
  const hayTarjetas = Boolean(tarjetas);
  const hayBloques = hayGraficos || hayTarjetas;

  return (
    <div className="space-y-5">
      {tabs}

      {hayBloques && (
        <div className="flex items-center justify-end gap-2">
          {hayGraficos && (
            <BotonBloque
              id={id}
              bloque="graficos"
              label="Gráficos"
              visible={verGraficos}
              onToggle={() => toggle("graficos")}
            />
          )}
          {hayTarjetas && (
            <BotonBloque
              id={id}
              bloque="tarjetas"
              label="Tarjetas"
              visible={verTarjetas}
              onToggle={() => toggle("tarjetas")}
            />
          )}
        </div>
      )}

      {hayGraficos && verGraficos && (
        <div id={`${id}-graficos`} className="grid gap-5 xl:grid-cols-2">
          {graficos}
        </div>
      )}

      {hayTarjetas && verTarjetas && (
        <div
          id={`${id}-tarjetas`}
          className={cn("grid", GRID_TARJETAS[columnasTarjetas] ?? GRID_TARJETAS[4])}
        >
          {tarjetas}
        </div>
      )}

      {filtros}

      {children}
    </div>
  );
}
