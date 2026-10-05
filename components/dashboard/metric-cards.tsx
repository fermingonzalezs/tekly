import { Card } from "@/components/ui/card";
import { Delta } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import type { MetricaDashboard } from "@/lib/dashboard";

function MetricCard({
  label,
  value,
  delta,
  deltaHint,
  destacada,
  className,
}: {
  label: string;
  value: string;
  delta?: number;
  deltaHint: string;
  destacada?: boolean;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "p-3",
        destacada &&
          "col-span-2 border-accent bg-accent text-white shadow-lg shadow-accent/20",
        className,
      )}
    >
      <p
        className={cn(
          "truncate text-[10px] font-semibold uppercase tracking-wider text-neutral-500 sm:text-[11px]",
          destacada && "text-white/80",
        )}
      >
        {label}
      </p>
      <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
        <span className="font-grotesk text-xl font-semibold leading-none tracking-tight tabular-nums sm:text-3xl">
          {value}
        </span>
        <div className="flex items-center gap-1.5 leading-none sm:shrink-0 sm:flex-col sm:items-end sm:gap-1">
          {delta !== undefined && (
            <Delta
              value={delta}
              className={cn(
                "px-1.5 py-0.5 text-[10px]",
                destacada && "bg-white/25 text-white",
              )}
            />
          )}
          <span
            className={cn(
              "whitespace-nowrap text-[10px]",
              destacada ? "text-white/70" : "text-neutral-500",
            )}
          >
            {deltaHint}
          </span>
        </div>
      </div>
    </Card>
  );
}

/** Celdas de la grilla: la destacada ocupa 2 -- la fila cierra pareja en `xl`
 * (admin: 5 métricas + 1 = 6 col; empleado: 4 + 1 = 5 col; sin destacada
 * (ej. la landing): N métricas = N col). En mobile la destacada va a ancho
 * completo (`col-span-2` de `grid-cols-2`). */
const XL_COLS: Record<number, string> = {
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
};

export function MetricCards({ metrics }: { metrics: MetricaDashboard[] }) {
  const cells = metrics.length + (metrics.some((m) => m.destacada) ? 1 : 0);
  return (
    <div
      className={cn(
        "grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-3",
        XL_COLS[cells] ?? "xl:grid-cols-4",
      )}
    >
      {metrics.map((m) => (
        <MetricCard
          key={m.key}
          label={m.label}
          value={m.value}
          delta={m.delta}
          deltaHint={m.deltaHint}
          destacada={m.destacada}
        />
      ))}
    </div>
  );
}
