import { cn } from "@/lib/utils";

/** Título de gráfico / encabezado de card: siempre en mayúscula.
 *  Centrado por defecto; `align="left"` para alinear a la izquierda.
 *  `sub` = línea de contexto abajo. `divider` = línea fina abajo (patrón
 *  "título + subtítulo + línea" del dashboard). */
export function ChartTitle({
  children,
  sub,
  align = "center",
  divider = false,
}: {
  children: React.ReactNode;
  sub?: React.ReactNode;
  align?: "center" | "left";
  divider?: boolean;
}) {
  return (
    <div
      className={cn(
        align === "left" ? "text-left" : "text-center",
        divider && "mb-3 border-b border-neutral-100 pb-3",
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
        {children}
      </p>
      {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}
