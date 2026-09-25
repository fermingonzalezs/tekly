"use client";

import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { heatCell, DASH_HEAT } from "@/lib/chart";
import type { Ticket } from "@/lib/types";

const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const FRANJAS = [
  { label: "Mañana", test: (h: number) => h < 13 },
  { label: "Tarde", test: (h: number) => h >= 13 && h < 17 },
  { label: "Noche", test: (h: number) => h >= 17 },
];

/** Heatmap de actividad: cuándo ingresan equipos, por día de la semana
 * (Lun..Dom) y franja horaria. La hora sale del display `ingreso`
 * ("07 sep 14:32" -> últimos 5 chars) para no tocar el modelo de Ticket
 * con un campo más; el día, con el mismo parseo local-safe que
 * `ticketsPorDiaSemana`. Reemplaza al chart de "tickets por día de la
 * semana": el total por día es la suma de su columna. */
export function HeatmapActividad({
  tickets,
  className,
}: {
  tickets: Ticket[];
  className?: string;
}) {
  const grid = FRANJAS.map(() => Array.from({ length: 7 }, () => 0));
  for (const t of tickets) {
    const [y, m, d] = t.fechaISO.split("-").map(Number);
    const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // Lun=0..Dom=6
    const hora = parseInt(t.ingreso.slice(-5), 10);
    const fi = FRANJAS.findIndex((f) => f.test(hora));
    if (fi >= 0) grid[fi][dow]++;
  }
  const max = Math.max(1, ...grid.flat());
  const total = grid.flat().reduce((a, n) => a + n, 0);

  return (
    <Card className={cn("flex h-full flex-col p-5", className)}>
      <ChartTitle align="left" divider sub="ingresos de equipos por día y franja horaria">
        Actividad semanal
      </ChartTitle>
      {total === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          Sin ingresos de equipos en el período filtrado.
        </p>
      ) : (
        // `flex-1 justify-center` -- la tarjeta de al lado ("Reparaciones por
        // tipo de falla") suele quedar bastante más alta (hasta 8 fallas +
        // leyenda), y este heatmap con solo 3 filas se veía pegado arriba con
        // un hueco vacío abajo. Centrado + filas más separadas (space-y-3 en
        // vez de 1.5) reparte mejor ese alto disponible en vez de desperdiciarlo.
        // Sin `max-w-*`: las celdas son `aspect-square`, así que el grid entero
        // escala con el ancho disponible de la card sin deformarse -- cuanto
        // más ancho le demos, más grande (y alto) sale.
        <div className="mt-3 flex flex-1 flex-col justify-center overflow-x-auto px-2">
          <div className="mx-auto w-full min-w-[320px]">
            <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-1.5">
              <span />
              {DOW.map((d) => (
                <span
                  key={d}
                  className="text-center text-[10px] font-medium uppercase tracking-wide text-neutral-400"
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="mt-2 space-y-3">
              {FRANJAS.map((f, fi) => (
                <div
                  key={f.label}
                  className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] items-center gap-1.5"
                >
                  <span className="text-[11px] text-neutral-400">{f.label}</span>
                  {grid[fi].map((count, di) => {
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
