"use client";

import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { CHART_ACCENT, CHART_COLORS } from "@/lib/chart";
import { fmtUsd } from "@/lib/format";
import type { RentabilidadMes } from "@/lib/analiticas";

/** Evolución de rentabilidad: área de facturación + línea de ganancia
 * (misma escala USD) y, abajo, el margen % con escala propia. Dos mini
 * charts que comparten el eje X responden "¿vendo más y gano más?" sin
 * caer en un doble eje, que es lo que vuelve ilegible a un dual-axis.
 * Mismo enfoque SVG (viewBox 100x100 estirado) que `TrendChart`. */
export function RentabilidadEvolucion({
  data,
  className,
}: {
  data: RentabilidadMes[];
  className?: string;
}) {
  const maxFact = Math.max(1, ...data.map((d) => d.facturacion));
  const maxMargen = Math.max(1, ...data.map((d) => d.margenPct));
  const n = data.length;
  const x = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  // % desde arriba, para SVG y para los dots HTML
  const y = (v: number, max: number) => 100 - (v / max) * 100;

  const puntos = data.map((d, i) => ({
    ...d,
    x: x(i),
    yF: y(d.facturacion, maxFact),
    yG: y(d.ganancia, maxFact),
    yM: y(d.margenPct, maxMargen),
  }));
  const linea = (key: "yF" | "yG" | "yM") =>
    puntos.map((p) => `L ${p.x} ${p[key]}`).join(" ").replace("L", "M");
  const area = `${linea("yF")} L ${puntos[n - 1]?.x ?? 0} 100 L ${puntos[0]?.x ?? 0} 100 Z`;

  const vacio = data.every((d) => d.facturacion === 0 && d.ganancia === 0);

  return (
    <Card className={cn("p-5", className)}>
      <ChartTitle align="left" divider sub="facturación vs ganancia real, por mes">
        Evolución de rentabilidad
      </ChartTitle>
      {vacio ? (
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          Sin ventas en el período filtrado.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: CHART_COLORS[0] }}
              />
              Facturación
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ background: CHART_ACCENT }}
              />
              Ganancia
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ background: CHART_COLORS[4] }}
              />
              Margen %
            </span>
          </div>

          <div className="relative mt-3 h-36">
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="rentFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#rentFill)" />
              <path
                d={linea("yF")}
                fill="none"
                stroke={CHART_COLORS[0]}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={linea("yG")}
                fill="none"
                stroke={CHART_ACCENT}
                strokeWidth="2"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {/* dots como HTML para que no los deforme el viewBox estirado */}
            {puntos.map((p) => (
              <span
                key={`f${p.mes}`}
                className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${p.x}%`, top: `${p.yF}%`, background: CHART_COLORS[0] }}
              />
            ))}
            {puntos.map((p) => (
              <span
                key={`g${p.mes}`}
                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
                style={{ left: `${p.x}%`, top: `${p.yG}%`, background: CHART_ACCENT }}
              />
            ))}
            {/* hover por columna con el detalle completo */}
            {puntos.map((p, i) => (
              <div
                key={`h${p.mes}`}
                className="absolute inset-y-0"
                style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }}
                title={`${p.mes}: facturación ${fmtUsd(p.facturacion)} · ganancia ${fmtUsd(p.ganancia)} · margen ${p.margenPct.toFixed(1)}%`}
              />
            ))}
          </div>

          {/* margen %: escala propia, comparte el eje X */}
          <div className="relative mt-2 h-10">
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path
                d={linea("yM")}
                fill="none"
                stroke={CHART_COLORS[4]}
                strokeWidth="2"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {puntos.map((p) => (
              <span
                key={`m${p.mes}`}
                className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${p.x}%`, top: `${p.yM}%`, background: CHART_COLORS[4] }}
              />
            ))}
          </div>

          <div className="relative mt-1 h-8">
            {puntos.map((p, i) => (
              <span
                key={`l${p.mes}`}
                className={cn(
                  "absolute top-0 whitespace-nowrap text-xs text-neutral-500",
                  i === 0 && n > 1 ? "left-0 text-left" : i === n - 1 ? "right-0 text-right" : "-translate-x-1/2",
                )}
                style={i > 0 && i < n - 1 ? { left: `${p.x}%` } : undefined}
              >
                {p.mes}
                <span
                  className="block text-[10px] font-medium tabular-nums"
                  style={{ color: CHART_COLORS[4] }}
                >
                  {p.margenPct.toFixed(1)}%
                </span>
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
