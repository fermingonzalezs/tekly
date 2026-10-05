"use client";

import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { heatCell, DASH_HEAT } from "@/lib/chart";
import { ACTIVIDAD_FRANJAS } from "@/lib/analiticas";

const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Heatmap de actividad: cuándo ingresan equipos, por día de la semana
 * (Lun..Dom) y franja horaria. La grilla se calcula en el server
 * (`actividadTickets`, lib/analiticas.ts) y llega como `grid`; el cliente
 * solo dibuja. Reemplaza al chart de "tickets por día de la semana": el
 * total por día es la suma de su columna. */
export function HeatmapActividad({
  grid,
  className,
}: {
  /** 3 franjas (mañana/tarde/noche) × 7 días (Lun..Dom). */
  grid: number[][];
  className?: string;
}) {
  const max = Math.max(1, ...grid.flat());
  const total = grid.flat().reduce((a, n) => a + n, 0);

  return (
    <Card className={cn("flex h-full flex-col p-5", className)}>
      <ChartTitle align="left" divider sub="ingresos de equipos por día y franja horaria">
        Actividad semanal
      </ChartTitle>
      {total === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500">
          Sin ingresos de equipos en el período filtrado.
        </p>
      ) : (
        <div className="mt-3 flex flex-1 flex-col justify-center overflow-x-auto px-2">
          <div className="mx-auto w-full min-w-[320px]">
            <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-1.5">
              <span />
              {DOW.map((d) => (
                <span
                  key={d}
                  className="text-center text-[10px] font-medium uppercase tracking-wide text-neutral-500"
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="mt-2 space-y-3">
              {ACTIVIDAD_FRANJAS.map((f, fi) => (
                <div
                  key={f.label}
                  className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] items-center gap-1.5"
                >
                  <span className="text-[11px] text-neutral-500">{f.label}</span>
                  {(grid[fi] ?? []).map((count, di) => {
                    const { bg, dark } = heatCell(count, 0, max, DASH_HEAT);
                    return (
                      <div
                        key={di}
                        title={`${DOW[di]} · ${f.label} — ${count} ${count === 1 ? "ingreso" : "ingresos"}`}
                        className={cn(
                          "flex aspect-square items-center justify-center rounded-md text-[11px] font-semibold tabular-nums",
                          dark ? "text-neutral-600" : "text-white",
                        )}
                        style={{ background: bg }}
                      >
                        {count > 0 ? count : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
