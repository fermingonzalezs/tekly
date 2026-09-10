import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Variación porcentual como pill verde/rojo (sin flecha). */
export function Delta({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold leading-none tabular-nums",
        up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500",
        className,
      )}
    >
      {up ? "+" : "−"}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

/**
 * Tarjeta de métrica reutilizable (estilo Dashboard): ícono opcional,
 * label chico, valor grande con tabular-nums y, si se pasa `delta`,
 * la variación % con su leyenda. Centrada por defecto.
 *
 * Usar en TODA la app para filas de KPIs — no rehacer cards de stats a mano.
 */
export function StatCard({
  label,
  value,
  delta,
  deltaHint = "vs mes previo",
  hint,
  align = "center",
  valueClassName,
  className,
  onClick,
  active,
}: {
  label: string;
  value: React.ReactNode;
  /** Si se pasa, se muestra la variación % con flecha y `deltaHint`. */
  delta?: number;
  deltaHint?: string;
  /** Nota secundaria cuando no hay `delta`. */
  hint?: string;
  align?: "center" | "left";
  /** Para teñir el valor, ej. "text-emerald-600". */
  valueClassName?: string;
  className?: string;
  /** Vuelve la card clickeable (ej. filtro tipo pipeline). */
  onClick?: () => void;
  /** Estado seleccionado cuando la card es clickeable. */
  active?: boolean;
}) {
  const center = align === "center";
  return (
    <Card
      onClick={onClick}
      className={cn(
        "overflow-hidden p-4",
        center && "text-center",
        onClick && "cursor-pointer transition-colors hover:border-neutral-300",
        active && "border-accent bg-accent-soft",
        className,
      )}
    >
      <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-grotesk text-3xl font-semibold tracking-tight tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </p>
      {delta !== undefined ? (
        <div
          className={cn(
            "mt-1.5 flex items-center gap-1 whitespace-nowrap",
            center && "justify-center",
          )}
        >
          <Delta value={delta} />
          <span className="text-[11px] text-neutral-400">{deltaHint}</span>
        </div>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-neutral-400">{hint}</p>
      ) : null}
    </Card>
  );
}
