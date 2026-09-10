import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { GHOST_STRIPES, CHART_ACCENT } from "@/lib/chart";
import { tickets } from "@/lib/mock-data";

const TERMINADAS = ["listo", "entregado"];

export function ReparacionesSplit({ className }: { className?: string }) {
  const terminadas = tickets.filter((t) => TERMINADAS.includes(t.estado)).length;
  const enCurso = tickets.length - terminadas;
  const total = terminadas + enCurso || 1;
  const pct = (terminadas / total) * 100;

  return (
    <Card className={cn("flex flex-col p-5", className)}>
      <ChartTitle align="left" divider>
        Reparaciones
      </ChartTitle>

      <div className="flex flex-1 flex-col justify-center">
        <div className="relative h-9">
          <div className="flex h-full overflow-hidden rounded-full">
            <div
              className="h-full"
              style={{ width: `${pct}%`, background: CHART_ACCENT }}
            />
            <div
              className="h-full flex-1"
              style={{ background: GHOST_STRIPES }}
            />
          </div>
          {/* marcador en el punto de corte */}
          <div
            className="absolute -top-1.5 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${pct}%` }}
          >
            <span
              className="border-x-[5px] border-t-[6px] border-x-transparent"
              style={{ borderTopColor: CHART_ACCENT }}
            />
            <span className="h-11 w-px border-l border-dashed border-neutral-300" />
          </div>
        </div>

        <div className="mt-7 flex items-end justify-between">
          <div>
            <p className="text-xl font-semibold tabular-nums">{terminadas}</p>
            <p className="text-xs text-neutral-400">Terminadas</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold tabular-nums">{enCurso}</p>
            <p className="text-xs text-neutral-400">En curso</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
