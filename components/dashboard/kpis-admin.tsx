import { Card } from "@/components/ui/card";
import { Delta } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import type { MetricaDashboard } from "@/lib/dashboard";

/** Fila de KPIs del dashboard de admin: 4 tarjetas centradas (label →
 * línea → número → delta). La `destacada` va sobre `table-header` (índigo
 * medio del tema, no negro) con el número en índigo claro. Los deltas de
 * margen vienen en puntos, el resto en %. */
export function KpisAdmin({ metrics }: { metrics: MetricaDashboard[] }) {
  // 3 tarjetas (dashboard de empleado) → 3 columnas parejas; 4 (admin) → 4.
  return (
    <div
      className={cn(
        "grid gap-3",
        metrics.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-4",
      )}
    >
      {metrics.map((m) => (
        <Card
          key={m.key}
          className={cn(
            "flex flex-col items-center px-4 pb-4 pt-3.5 text-center",
            m.destacada && "border-table-header bg-table-header text-white shadow-lg shadow-table-header/20",
          )}
        >
          <p
            className={cn(
              "w-full border-b pb-2.5 text-[11px] font-semibold uppercase tracking-wider",
              m.destacada ? "border-white/15 text-white/75" : "border-neutral-100 text-neutral-500",
            )}
          >
            {m.label}
          </p>
          <p
            className={cn(
              "mt-3 font-grotesk text-2xl font-semibold leading-none tracking-tight tabular-nums sm:text-3xl",
              m.destacada ? "text-[#c9c5f5]" : "text-neutral-900",
            )}
          >
            {m.value}
          </p>
          <div className="mt-2.5 flex min-h-[20px] items-center gap-1.5">
            {m.delta !== undefined ? (
              <Delta
                value={m.delta}
                className={cn("px-1.5 py-0.5 text-[10px]", m.destacada && (m.delta >= 0 ? "bg-white text-emerald-700" : "bg-white text-red-600"),
                )}
              />
            ) : null}
            <span className={cn("text-[11px]", m.destacada ? "text-white/70" : "text-neutral-500")}>
              {m.deltaHint}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
