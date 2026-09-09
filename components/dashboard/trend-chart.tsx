"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { salesTrend3w } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";

const SCALE = 78; // alto de la barra más alta, en % de la banda
const LINE = "#84cc16"; // lima — línea de tendencia

// 3 colores sólidos, corte directo de uno a otro (sin degradé)
const BAR_FILL =
  "linear-gradient(to top, #7c3aed 0%, #7c3aed 33.33%, #3b82f6 33.33%, #3b82f6 66.66%, #22c55e 66.66%, #22c55e 100%)";

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

export function TrendChart({ className }: { className?: string }) {
  const [hover, setHover] = useState<number | null>(null);

  const data = salesTrend3w;
  const n = data.length;
  const max = Math.max(...data);
  const avg = data.reduce((a, b) => a + b, 0) / n;
  const mom = n > 1 ? ((data[n - 1] - data[n - 2]) / data[n - 2]) * 100 : 0;

  const pts: Pt[] = data.map((v, i) => ({
    x: ((i + 0.5) / n) * 100,
    y: 100 - (v / max) * SCALE,
  }));
  const curve = smoothPath(pts);
  const area = `${curve} L ${pts[n - 1].x} 100 L ${pts[0].x} 100 Z`;
  const avgY = 100 - (avg / max) * SCALE;

  return (
    <Card className={cn("flex flex-col p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <ChartTitle align="left">Tendencia de ventas</ChartTitle>
        <span
          className={cn(
            "shrink-0 rounded-md px-2 py-1 text-xs font-semibold",
            mom >= 0
              ? "bg-emerald-50 text-emerald-600"
              : "bg-red-50 text-red-600",
          )}
        >
          {mom >= 0 ? "+" : ""}
          {mom.toFixed(1).replace(".", ",")} %
        </span>
      </div>
      <p className="mt-1 text-[11px] text-neutral-400">
        Últimas 3 semanas · promedio {fmtUsd(Math.round(avg))}
      </p>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-1.5">
        <div
          className="relative flex flex-1 items-end gap-1.5"
          onMouseLeave={() => setHover(null)}
        >
          {data.map((v, i) => {
            const dim = hover !== null && hover !== i;
            return (
              <div
                key={i}
                className="flex h-full flex-1 flex-col items-center justify-end"
                onMouseEnter={() => setHover(i)}
              >
                <span
                  className={cn(
                    "mb-1 text-[9px] tabular-nums transition-opacity",
                    dim ? "text-neutral-300" : "text-neutral-400",
                    i % 2 === 0 || hover === i ? "" : "invisible",
                  )}
                >
                  {v}
                </span>
                <div
                  className={cn(
                    "w-full rounded-t-[5px] transition-opacity",
                    dim && "opacity-40",
                  )}
                  style={{
                    height: `${(v / max) * SCALE}%`,
                    backgroundImage: BAR_FILL,
                  }}
                />
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
              className="pointer-events-none absolute -top-1 z-20 -translate-x-1/2 rounded-lg bg-neutral-900 px-3 py-2 text-xs text-white shadow-lg"
              style={{ left: `${((hover + 0.5) / n) * 100}%` }}
            >
              <p className="whitespace-nowrap font-semibold">
                {hover === n - 1 ? "Hoy" : `Hace ${n - 1 - hover} días`}
              </p>
              <p className="mt-0.5 whitespace-nowrap tabular-nums">
                {fmtUsd(data[hover])}
              </p>
              <p className="mt-0.5 whitespace-nowrap text-[11px] text-neutral-300">
                {data[hover] >= avg ? "+" : "−"}
                {Math.abs(Math.round(((data[hover] - avg) / avg) * 100))}% vs
                promedio
              </p>
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
