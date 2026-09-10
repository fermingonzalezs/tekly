"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { salesTrend3w, salesTrend3wGanancia, ventasPorRubro } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";
import { dashColor, DASH_ACCENT, GHOST_STRIPES } from "@/lib/chart";

const SCALE = 100; // la barra más alta ocupa todo el alto de la banda
const LINE = DASH_ACCENT; // índigo — línea de ganancia
// barra en reposo: sin color, rayado diagonal gris visible
const BAR_GHOST = GHOST_STRIPES;

// al hacer hover, la barra del día se parte según el mix de rubros del mes
// (mismos colores y orden que la dona "Rubros más vendidos").
const RUBRO_MIX = (() => {
  const r = ventasPorRubro.mes;
  const t = r.reduce((a, x) => a + x.value, 0) || 1;
  return r.map((x) => ({ label: x.label, pct: (x.value / t) * 100 }));
})();

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
  venta = salesTrend3w,
  ganancia = salesTrend3wGanancia,
  sub = "Valores de las últimas tres semanas",
}: {
  className?: string;
  venta?: number[];
  ganancia?: number[];
  sub?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const data = venta; // barra = venta bruta del día
  const profit = ganancia; // línea = ganancia del día
  const n = data.length;
  const max = Math.max(...data);
  const avg = profit.reduce((a, b) => a + b, 0) / n; // ganancia promedio
  const avgVenta = data.reduce((a, b) => a + b, 0) / n;

  const pts: Pt[] = profit.map((v, i) => ({
    x: ((i + 0.5) / n) * 100,
    y: 100 - (v / max) * SCALE,
  }));
  const curve = smoothPath(pts);
  const area = `${curve} L ${pts[n - 1].x} 100 L ${pts[0].x} 100 Z`;
  const avgY = 100 - (avg / max) * SCALE;

  return (
    <Card className={cn("flex flex-col p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <ChartTitle align="left" sub={sub}>
          Tendencia de ventas
        </ChartTitle>
        <div className="flex shrink-0 gap-4 text-right">
          <div>
            <p className="text-sm font-semibold tabular-nums">
              {fmtUsd(Math.round(avgVenta))}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Venta prom.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold tabular-nums">
              {fmtUsd(Math.round(avg))}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Ganancia prom.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-neutral-100 pt-3 text-[10px] text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-[3px] border border-neutral-300"
            style={{ background: BAR_GHOST }}
          />
          Venta
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-[3px] w-3.5 rounded-full"
            style={{ background: LINE }}
          />
          Ganancia
        </span>
      </div>

      <div className="mt-2 flex aspect-[5/2] w-full flex-col gap-1.5 xl:aspect-auto xl:min-h-0 xl:flex-1">
        <div
          className="relative flex flex-1 items-end gap-1.5"
          onMouseLeave={() => setHover(null)}
        >
          {data.map((v, i) => {
            const on = hover === i;
            return (
              <div
                key={i}
                className="flex h-full flex-1 flex-col justify-end"
                onMouseEnter={() => setHover(i)}
              >
                <div
                  className={cn(
                    "flex w-full flex-col overflow-hidden rounded-t-xl border transition-colors",
                    on ? "border-transparent" : "border-neutral-300",
                  )}
                  style={{
                    height: `${(v / max) * SCALE}%`,
                    background: on ? undefined : BAR_GHOST,
                  }}
                >
                  {on &&
                    RUBRO_MIX.map((r, ri) => (
                      <div
                        key={r.label}
                        style={{
                          height: `${r.pct}%`,
                          background: dashColor(ri),
                        }}
                      />
                    ))}
                </div>
              </div>
            );
          })}

          {/* línea de promedio */}
          <div
            className="pointer-events-none absolute inset-x-0 z-10"
            style={{ top: `${avgY}%` }}
          >
            <div className="border-t border-dashed border-neutral-400" />
            <span className="absolute -top-2.5 left-0 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
              Avg
            </span>
          </div>

          {/* curva de tendencia */}
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
                {hover === n - 1 ? "Hoy" : `Hace ${n - 1 - hover} días`}
              </p>
              <p className="mt-1 flex items-center gap-1.5 whitespace-nowrap tabular-nums">
                <span className="h-2 w-2 rounded-sm bg-white/80" />
                Venta
                <span className="ml-auto pl-3 font-semibold">
                  {fmtUsd(data[hover])}
                </span>
              </p>
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

              <div className="mt-1.5 space-y-0.5 border-t border-white/15 pt-1.5">
                {RUBRO_MIX.map((r, ri) => (
                  <p
                    key={r.label}
                    className="flex items-center gap-1.5 whitespace-nowrap tabular-nums"
                  >
                    <span
                      className="h-2 w-2 rounded-sm"
                      style={{ background: dashColor(ri) }}
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

        <div className="flex gap-1.5">
          {data.map((_, i) => (
            <span
              key={i}
              className="flex-1 text-center text-[10px] tabular-nums text-neutral-400"
            >
              {i % 3 === 0 ? i + 1 : ""}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
