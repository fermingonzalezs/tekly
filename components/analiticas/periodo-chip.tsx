import { cn } from "@/lib/utils";

/** Chip de contexto de una card de Analíticas que **no** depende del período
 * filtrado: "Estado actual" (foto del stock/antigüedad) o el rango fijo que
 * usa ("Últimos 3 meses"). Va dentro del `sub` del `ChartTitle` para que se
 * sepa de un vistazo qué gráfico respeta el filtro de fecha y cuál no
 * (plan 008). */
export function PeriodoChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md bg-neutral-100 px-1.5 text-[11px] font-medium text-neutral-600",
        className,
      )}
    >
      {children}
    </span>
  );
}
