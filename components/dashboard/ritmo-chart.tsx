"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/format";
import { CHART_COLORS, DASH_ACCENT, fmtUsdCompact, ticksEje } from "@/lib/chart";
import type { RitmoMes } from "@/lib/dashboard";

const ANTERIOR = CHART_COLORS[4];

type Pt = { x: number; y: number };

// spline Catmull-Rom -> curva Bézier suave que pasa por todos los puntos
function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return "";
  const d = [`M ${pts[0].x} ${pts[0].y}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d.push(
      `C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`,
    );
  }
  return d.join(" ");
}

/** "Ritmo del mes": venta acumulada día a día vs el mes anterior y vs el
 * ritmo ideal para llegar a la meta (`target`). */
export function RitmoChart({
  className,
  ritmo,
  target,
}: {
  className?: string;
  ritmo: RitmoMes;
  target: number;
}) {
  const { acumulado, anterior, daysInMonth, dayOfMonth, esActual } = ritmo;
  const [hover, setHover] = useState<number | null>(null);

  const conMeta = target > 0;
  const maxDato = Math.max(
    1,
    conMeta ? target : 0,
    acumulado[acumulado.length - 1] ?? 0,
    anterior[anterior.length - 1] ?? 0,
  );
  const ticks = ticksEje(maxDato);
  const max = ticks[ticks.length - 1];

  const span = Math.max(1, daysInMonth - 1);
  const xDe = (dia: number) => ((dia - 1) / span) * 100;
  const yDe = (v: number) => 100 - (v / max) * 100;
  const serie = (vals: number[]): Pt[] =>
    vals.map((v, i) => ({ x: xDe(i + 1), y: yDe(v) }));

  const ptsAcum = serie(acumulado);
  const curvaAcum = smoothPath(ptsAcum);
  const area =
    ptsAcum.length > 1
      ? `${curvaAcum} L ${ptsAcum[ptsAcum.length - 1].x} 100 L ${ptsAcum[0].x} 100 Z`
      : "";
  const curvaPrev = smoothPath(serie(anterior));
  const idealY = (dia: number) => yDe((target * dia) / daysInMonth);

  const dias = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const xLabels = dias.filter((d) => d === 1 || d % 2 === 1 || d === daysInMonth);

  return (
    <Card className={cn("flex flex-col p-4", className)}>
      <ChartTitle
        align="left"
        sub="Cómo se fue acumulando la venta día a día, comparada con el mes anterior y el ritmo ideal para llegar al objetivo"
      >
        Ritmo del mes
      </ChartTitle>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-100 pt-3 text-[11px] text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: DASH_ACCENT }} />
          Acumulado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: ANTERIOR }} />
          Mes anterior
        </span>
        {conMeta && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-neutral-400" />
            Ritmo ideal
          </span>
        )}
      </div>

      <div className="mt-3 flex min-h-[180px] flex-1 flex-col gap-1.5">
        <div className="relative flex min-h-0 flex-1" onMouseLeave={() => setHover(null)}>
          {/* Eje Y alineado con las líneas guía */}
          <div className="relative w-12 shrink-0 text-[10px] tabular-nums text-neutral-500">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute left-0 -translate-y-1/2"
                style={{ top: `${yDe(t)}%` }}
              >
                {t === 0 ? "U$ 0" : fmtUsdCompact(t)}
              </span>
            ))}
          </div>

          <div className="relative min-w-0 flex-1">
            {ticks.map((t) => (
              <div
                key={t}
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 border-t border-neutral-100"
                style={{ top: `${yDe(t)}%` }}
              />
            ))}

            <svg
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="ritmoFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={DASH_ACCENT} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={DASH_ACCENT} stopOpacity="0" />
                </linearGradient>
              </defs>
              {conMeta && (
                <line
                  x1={xDe(1)}
                  y1={idealY(1)}
                  x2={xDe(daysInMonth)}
                  y2={idealY(daysInMonth)}
                  stroke="#a3a3a3"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {area && <path d={area} fill="url(#ritmoFill)" />}
              <path
                d={curvaPrev}
                fill="none"
                stroke={ANTERIOR}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={curvaAcum}
                fill="none"
                stroke={DASH_ACCENT}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {esActual && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 border-l border-dashed border-neutral-400"
                style={{ left: `${xDe(dayOfMonth)}%` }}
              >
                <span className="absolute -top-1 left-1 text-[10px] font-semibold text-neutral-600">
                  Hoy
                </span>
              </div>
            )}

            {/* columnas de hover, una por día transcurrido */}
            <div className="absolute inset-0 flex">
              {dias.map((d) => (
                <div
                  key={d}
                  className="h-full flex-1"
                  onMouseEnter={() => d <= dayOfMonth && setHover(d)}
                />
              ))}
            </div>

            {hover !== null && acumulado[hover - 1] !== undefined && (
              <>
                <span
                  className="pointer-events-none absolute z-10 h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 bg-white"
                  style={{
                    left: `${xDe(hover)}%`,
                    bottom: `${100 - yDe(acumulado[hover - 1])}%`,
                    borderColor: DASH_ACCENT,
                  }}
                />
                <div
                  className={cn(
                    "pointer-events-none absolute top-2 z-20 whitespace-nowrap rounded-lg bg-neutral-900 px-3 py-2 text-xs text-white shadow-lg",
                    hover > daysInMonth / 2 ? "-translate-x-full -ml-3" : "ml-3",
                  )}
                  style={{ left: `${xDe(hover)}%` }}
                >
                  <p className="text-center font-semibold">Día {hover}</p>
                  <p className="mt-1 flex items-center gap-1.5 tabular-nums">
                    <span className="h-2 w-2 rounded-sm" style={{ background: DASH_ACCENT }} />
                    Acumulado
                    <span className="ml-auto pl-3 font-semibold">
                      {fmtUsd(acumulado[hover - 1])}
                    </span>
                  </p>
                  {anterior[hover - 1] !== undefined && (
                    <p className="mt-0.5 flex items-center gap-1.5 tabular-nums">
                      <span className="h-2 w-2 rounded-sm" style={{ background: ANTERIOR }} />
                      Mes anterior
                      <span className="ml-auto pl-3 font-semibold">
                        {fmtUsd(anterior[hover - 1])}
                      </span>
                    </p>
                  )}
                  {conMeta && (
                    <p className="mt-0.5 flex items-center gap-1.5 tabular-nums">
                      <span className="h-2 w-2 rounded-sm bg-neutral-400" />
                      Ritmo ideal
                      <span className="ml-auto pl-3 font-semibold">
                        {fmtUsd(Math.round((target * hover) / daysInMonth))}
                      </span>
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Eje X: días del mes */}
        <div className="relative ml-12 h-4">
          {xLabels.map((d) => (
            <span
              key={d}
              className="absolute -translate-x-1/2 text-[10px] tabular-nums text-neutral-500"
              style={{ left: `${xDe(d)}%` }}
            >
              {d}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
