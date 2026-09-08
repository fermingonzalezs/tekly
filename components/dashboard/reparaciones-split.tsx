import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { tickets } from "@/lib/mock-data";

const TERMINADAS = ["listo", "entregado"];

export function ReparacionesSplit() {
  const terminadas = tickets.filter((t) => TERMINADAS.includes(t.estado)).length;
  const enCurso = tickets.length - terminadas;
  const total = terminadas + enCurso || 1;
  const pct = (terminadas / total) * 100;

  return (
    <Card className="p-5">
      <ChartTitle align="left">Reparaciones</ChartTitle>

      <div className="relative mt-6 h-8">
        <div className="flex h-full overflow-hidden rounded-lg">
          <div
            className="h-full bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-500"
            style={{ width: `${pct}%` }}
          />
          <div className="h-full flex-1 bg-neutral-100 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.06)_5px,rgba(0,0,0,0.06)_10px)]" />
        </div>
        {/* marcador en el punto de corte */}
        <div
          className="absolute -top-1.5 flex -translate-x-1/2 flex-col items-center"
          style={{ left: `${pct}%` }}
        >
          <span className="border-x-[5px] border-t-[6px] border-x-transparent border-t-emerald-500" />
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
    </Card>
  );
}
