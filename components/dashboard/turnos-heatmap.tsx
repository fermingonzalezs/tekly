"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { turnos } from "@/lib/mock-data";
import { heatCell, DASH_HEAT } from "@/lib/chart";

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const FRANJAS = [
  { label: "Mañana", test: (h: number) => h < 13 },
  { label: "Tarde", test: (h: number) => h >= 13 && h < 17 },
  { label: "Noche", test: (h: number) => h >= 17 },
];

export function TurnosHeatmap({ className }: { className?: string }) {
  const router = useRouter();
  const [hover, setHover] = useState<{ fi: number; di: number } | null>(null);

  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const activos = turnos.filter((t) => t.estado !== "cancelado");

  // matriz franja × día
  const grid = FRANJAS.map((f) =>
    days.map(
      (_, dayOffset) =>
        activos.filter(
          (t) => t.dayOffset === dayOffset && f.test(parseInt(t.hora, 10)),
        ).length,
    ),
  );
  const maxCount = Math.max(1, ...grid.flat());

  const proximos = [...activos]
    .sort((a, b) => a.dayOffset - b.dayOffset || a.hora.localeCompare(b.hora))
    .slice(0, 5);

  const whenLabel = (off: number) =>
    off === 0 ? "Hoy" : DOW[days[off].getDay()];

  const cellTurnos = (fi: number, di: number) =>
    activos
      .filter(
        (t) =>
          t.dayOffset === di && FRANJAS[fi].test(parseInt(t.hora, 10)),
      )
      .sort((a, b) => a.hora.localeCompare(b.hora));

  return (
    <Card className={cn("flex flex-col p-4", className)}>
      <ChartTitle align="left" sub="Para la próxima semana">
        Turnos agendados
      </ChartTitle>

      <div className="mt-3 flex gap-5 border-t border-neutral-100 pt-3">
        {/* IZQUIERDA: próximos turnos */}
        <div className="flex w-48 shrink-0 flex-col justify-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Próximos
          </p>
          <ul className="divide-y divide-neutral-200 text-[13px]">
            {proximos.map((t) => (
              <li
                key={t.id}
                className="flex items-baseline justify-between gap-3 py-1.5"
              >
                <span className="shrink-0 tabular-nums text-neutral-400">
                  {whenLabel(t.dayOffset)} {t.hora}
                </span>
                <span className="min-w-0 truncate">{t.cliente}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* DERECHA: calendario */}
        <div className="min-w-0 flex-1 border-l border-neutral-200 pl-5">
          {/* encabezado de días */}
          <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-1">
            <span />
            {days.map((d, i) => (
              <span
                key={i}
                className="text-center text-[10px] font-medium uppercase tracking-wide text-neutral-400"
              >
                {DOW[d.getDay()]}
              </span>
            ))}
          </div>

          {/* filas: franja + celdas */}
          <div
            className="mt-1.5 space-y-1.5"
            onMouseLeave={() => setHover(null)}
          >
            {FRANJAS.map((f, fi) => (
              <div
                key={f.label}
                className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] items-center gap-1"
              >
                <span className="text-start text-[11px] text-neutral-400">
                  {f.label}
                </span>
                {grid[fi].map((count, di) => {
                  const { bg } = heatCell(count, 0, maxCount, DASH_HEAT);
                  const on = hover?.fi === fi && hover?.di === di;
                  const items = on ? cellTurnos(fi, di) : [];
                  return (
                    <div
                      key={di}
                      className="relative flex aspect-square cursor-pointer items-center justify-center rounded-md text-[11px] font-semibold tabular-nums text-white"
                      style={{ background: bg }}
                      onMouseEnter={() => setHover({ fi, di })}
                      onClick={() => router.push("/turnos")}
                    >
                      {count > 0 ? count : ""}

                      {on && items.length > 0 && (
                        <div
                          className={cn(
                            "pointer-events-none absolute bottom-full z-30 mb-2 w-max max-w-[220px] rounded-lg bg-neutral-900 px-3 py-2 text-left text-xs text-white shadow-lg",
                            di >= 5
                              ? "right-0"
                              : "left-1/2 -translate-x-1/2",
                          )}
                        >
                          <p className="whitespace-nowrap font-semibold">
                            {DOW[days[di].getDay()]} {days[di].getDate()} ·{" "}
                            {f.label}
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {items.map((t) => (
                              <li
                                key={t.id}
                                className="flex gap-2 whitespace-nowrap tabular-nums"
                              >
                                <span className="text-white/60">{t.hora}</span>
                                <span>{t.cliente}</span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-1.5 border-t border-white/15 pt-1 text-[10px] text-white/50">
                            Click para ver turnos
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
