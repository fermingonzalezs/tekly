import { Card } from "@/components/ui/card";
import { Delta } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import type { MetricaDashboard } from "@/lib/dashboard";

function MetricCard({
  label,
  value,
  delta,
  deltaHint,
  className,
}: {
  label: string;
  value: string;
  delta: number;
  deltaHint: string;
  className?: string;
}) {
  return (
    <Card className={cn("p-3", className)}>
      <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-neutral-400 sm:text-[11px]">
        {label}
      </p>
      <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
        <span className="font-grotesk text-xl font-semibold leading-none tracking-tight tabular-nums sm:text-3xl">
          {value}
        </span>
        <div className="flex items-center gap-1.5 leading-none sm:shrink-0 sm:flex-col sm:items-end sm:gap-1">
          <Delta value={delta} className="px-1.5 py-0.5 text-[10px]" />
          <span className="whitespace-nowrap text-[10px] text-neutral-400">
            {deltaHint}
          </span>
        </div>
      </div>
    </Card>
  );
}

export function MetricCards({ metrics }: { metrics: MetricaDashboard[] }) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
      {metrics.map((m) => (
        <MetricCard
          key={m.key}
          label={m.label}
          value={m.value}
          delta={m.delta}
          deltaHint={m.deltaHint}
          // "Tickets abiertos" es la 5ta métrica -- en mobile (grid-cols-2)
          // dejaba una sola tarjeta huérfana en la 3ra fila; se oculta para
          // que las otras 4 cierren en 2 filas parejas. Vuelve desde sm.
          className={m.key === "abiertos" ? "hidden sm:block" : undefined}
        />
      ))}
    </div>
  );
}
