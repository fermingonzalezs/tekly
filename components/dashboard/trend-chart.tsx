"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/format";
import {
  CHART_COLORS,
  CHART_TRACK,
  DASH_ACCENT,
  chartColor,
  fmtUsdCompact,
  ticksEje,
} from "@/lib/chart";
import { fechaCorta, fechaPartes } from "@/lib/dashboard";

const SCALE = 100; // la barra más alta ocupa todo el alto de la banda
const LINE = DASH_ACCENT; // índigo — línea de ganancia

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
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`);
  }
  return d.join(" ");
}

export function TrendChart({
  className,
  venta,
  ganancia,
  fechas,
  rubroMix,
  sub,
}: {
  className?: string;
  venta: number[];
  /** Línea de ganancia -- `undefined` en el dashboard de empleado
   * (vendedor): no se dibuja curva, marcadores, columna "Ganancia prom."
   * ni su fila del tooltip. */
  ganancia?: number[];
  /** ISO `YYYY-MM-DD` por barra (mismo largo que `venta`) para eje X y
   * tooltip con fechas reales. Sin `fechas` (ej. la landing) cae al
   * numerado por defecto. */
  fechas?: string[];
  /** Mix real Equipos/Reparaciones/Accesorios/Otros del período que se está
   * mostrando (mismo dato que alimenta el donut "Categorías más vendidas",
   * `ventasPorRubro` en `lib/dashboard.ts`) -- se parte la barra al hacer
   * hover con esto, no con un mock fijo. */
  rubroMix: { label: string; value: number }[];
  sub: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const totalRubros = rubroMix.reduce((a, r) => a + r.value, 0) || 1;
  const mix = rubroMix.map((r) => ({ label: r.label, pct: (r.value / totalRubros) * 100 }));

  const data = venta; // barra = venta bruta del día
  const profit = ganancia;
  const n = data.length;
  // Escala contra el máximo "lindo" de las marcas del eje Y (no el crudo),
  // para que las líneas guía caigan en valores reales.
  const ticks = ticksEje(Math.max(1, ...data));
  const max = ticks[ticks.length - 1];
  const avg = profit ? profit.reduce((a, b) => a + b, 0) / n : null; // ganancia promedio
  const avgVenta = data.reduce((a, b) => a + b, 0) / n;

  const pts: Pt[] = (profit ?? []).map((v, i) => ({
    x: ((i + 0.5) / n) * 100,
    y: 100 - (v / max) * SCALE,
  }));
  const curve = smoothPath(pts);
  const area = pts.length ? `${curve} L ${pts[n - 1].x} 100 L ${pts[0].x} 100 Z` : "";
  const avgY = avg !== null ? 100 - (avg / max) * SCALE : null;

  const tooltipFecha = (i: number): string => {
    if (!fechas?.[i]) {
      return i === n - 1 ? "Hoy" : `Hace ${n - 1 - i} días`;
    }
    return i === n - 1 ? "Hoy" : fechaCorta(fechas[i]);
  };

  return (
    <Card className={cn("flex flex-col p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <ChartTitle align="left" sub={sub}>
          Tendencia de ventas
        </ChartTitle>
        <div className="flex shrink-0 gap-4 text-right">
          <div>
            <p className="text-sm font-semibold tabular-nums">
              {fmtUsd(Math.round(avgVenta))}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Venta prom.
            </p>
          </div>
          {avg !== null && (
            <div>
              <p className="text-sm font-semibold tabular-nums">
                {fmtUsd(Math.round(avg))}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Ganancia prom.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-neutral-100 pt-3 text-[10px] text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-[3px]"
            style={{ background: CHART_TRACK }}
          />
          Venta
        </span>
        {profit && (
          <span className="flex items-center gap-1.5">
            <span
              className="h-[3px] w-3.5 rounded-full"
              style={{ background: LINE }}
            />
            Ganancia
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-[3px]"
            style={{ background: CHART_COLORS[3] }}
          />
          Hoy
        </span>
      </div>

      <div className="mt-2 flex aspect-[5/2] w-full flex-col gap-1.5 xl:aspect-auto xl:min-h-0 xl:flex-1">
        <div
          className="relative flex min-h-0 flex-1"
          onMouseLeave={() => setHover(null)}
        >
          {/* Eje Y: 3 marcas (0, mitad, máximo lindo) alineadas con las
              líneas guía */}
          <div className="relative w-8 shrink-0 text-[10px] tabular-nums text-neutral-500">
            <span className="absolute left-0 top-0 -translate-y-1/2">
              {fmtUsdCompact(ticks[2])}
            </span>
            <span className="absolute left-0 top-1/2 -translate-y-1/2">
              {fmtUsdCompact(ticks[1])}
            </span>
            <span className="absolute bottom-0 left-0">0</span>
          </div>

          <div className="relative flex min-w-0 flex-1 items-end gap-1.5">
            {/* líneas guía detrás de las barras */}
            {ticks.map((t) => (
              <div
                key={t}
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 border-t border-neutral-100"
                style={{ top: `${100 - (t / max) * SCALE}%` }}
              />
            ))}

            {data.map((v, i) => {
              const on = hover === i;
              // la barra del último día (hoy) marca dónde cae "hoy"
              const esHoy = i === n - 1;
              return (
                <div
                  key={i}
                  className="flex h-full flex-1 flex-col justify-end"
                  onMouseEnter={() => setHover(i)}
                >
                  <div
                    className="flex w-full flex-col overflow-hidden rounded-t-xl"
                    style={{
                      height: `${(v / max) * SCALE}%`,
                      background: on
                        ? undefined
                        : esHoy
                          ? CHART_COLORS[3]
                          : CHART_TRACK,
                    }}
                  >
                    {on &&
                      mix.map((r, ri) => (
                        <div
                          key={r.label}
                          style={{
                            height: `${r.pct}%`,
                            background: chartColor(ri),
                          }}
                        />
                      ))}
                  </div>
                </div>
              );
            })}

            {/* línea + pill de promedio (ganancia) */}
            {avgY !== null && (
              <div
                className="pointer-events-none absolute inset-x-0 z-10"
                style={{ top: `${avgY}%` }}
              >
                <div className="border-t border-dashed border-neutral-400" />
                <span className="absolute -top-2.5 right-0 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white tabular-nums">
                  Prom. {fmtUsd(Math.round(avg!))}
                </span>
              </div>
            )}

            {/* curva de tendencia */}
            {area && (
              <svg
                className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={LINE} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={LINE} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={area} fill="url(#trendFill)" />
                <path
                  d={curve}
                  fill="none"
                  stroke={LINE}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  opacity={hover === null ? 1 : 0.6}
                />
              </svg>
            )}

            {/* marcadores */}
            {pts.map((p, i) => (
              <span
                key={i}
                className={cn(
                  "pointer-events-none absolute z-10 -translate-x-1/2 translate-y-1/2 rounded-full border-2 bg-white transition-all",
                  hover === i ? "h-3 w-3" : "h-2 w-2",
                )}
                style={{
                  left: `${p.x}%`,
                  bottom: `${100 - p.y}%`,
                  borderColor: LINE,
                  opacity: hover === null || hover === i ? 1 : 0.5,
                }}
              />
            ))}

            {hover !== null && (
              <div
                className={cn(
                  "pointer-events-none absolute top-1/2 z-20 -translate-y-1/2 rounded-lg bg-neutral-900 px-3 py-2 text-xs text-white shadow-lg",
                  hover >= n - 3 ? "-translate-x-full -ml-3" : "ml-3",
                )}
                style={{
                  // desde el borde de la barra (no el centro) + gap, para no taparla
                  left: `${((hover + (hover >= n - 3 ? 0 : 1)) / n) * 100}%`,
                }}
              >
                <p className="whitespace-nowrap text-center font-semibold">
                  {tooltipFecha(hover)}
                </p>
                <p className="mt-1 flex items-center gap-1.5 whitespace-nowrap tabular-nums">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ background: hover === n - 1 ? CHART_COLORS[3] : CHART_TRACK }}
                  />
                  Venta
                  <span className="ml-auto pl-3 font-semibold">
                    {fmtUsd(data[hover])}
                  </span>
                </p>
                {profit && (
                  <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap tabular-nums">
                    <span
                      className="h-2 w-2 rounded-sm"
                      style={{ background: LINE }}
                    />
                    Ganancia
                    <span className="ml-auto pl-3 font-semibold">
                      {fmtUsd(profit[hover])}
                    </span>
                  </p>
                )}

                <div className="mt-1.5 space-y-0.5 border-t border-white/15 pt-1.5">
                  {mix.map((r, ri) => (
                    <p
                      key={r.label}
                      className="flex items-center gap-1.5 whitespace-nowrap tabular-nums"
                    >
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{ background: chartColor(ri) }}
                      />
                      <span className="text-white/70">{r.label}</span>
                      <span className="ml-auto pl-3 font-semibold">
                        {Math.round(r.pct)}%
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Eje X: día del mes cada 3 barras, mes abreviado en la primera */}
        <div className="ml-8 flex gap-1.5">
          {data.map((_, i) => {
            let label = "";
            if (i % 3 === 0) {
              const iso = fechas?.[i];
              if (iso) {
                const p = fechaPartes(iso);
                label = i === 0 ? `${p.dia} ${p.mes}` : String(p.dia);
              } else {
                label = String(i + 1);
              }
            }
            return (
              <span
                key={i}
                className="flex-1 text-center text-[10px] tabular-nums text-neutral-500"
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
