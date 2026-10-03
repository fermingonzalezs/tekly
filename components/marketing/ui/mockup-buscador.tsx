import { MockupChrome } from "./mockup-chrome";
import { BuscadorDemo } from "./buscador-demo";

/**
 * Ilustración "Nueva venta desde el buscador" para el showcase: el
 * buscador global (Cmd+K real, `components/command-palette/`) con una
 * casilla de búsqueda visible arriba del contenido (no solo atajo de
 * teclado ni el FAB flotante) -- al clickearla se abre la paleta con
 * "Nueva venta" resaltada en Acciones rápidas, mismo vidrio teñido de
 * accent que el real. Toda la animación vive en `BuscadorDemo` (leaf
 * client aislado); acá solo el marco estático.
 */
export function MockupBuscador({ className }: { className?: string }) {
  return (
    <div
      id="mockup-buscador-root"
      className={`relative flex aspect-video flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-accent/10 ${className ?? ""}`}
      aria-hidden="true"
    >
      <MockupChrome activo="Ventas" />
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <BuscadorDemo />
      </div>
    </div>
  );
}
