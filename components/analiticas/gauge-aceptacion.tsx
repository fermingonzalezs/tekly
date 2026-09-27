"use client";

import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";

/** Gauge radial (semicírculo) de la tasa de aceptación de presupuestos.
 * El arco se llena con `pathLength`/`strokeDasharray` en 0..100, sin
 * matemática de arcos. El contexto (aceptadas / presupuestadas) va abajo,
 * como pide la métrica. */
export function GaugeAceptacion({
  presupuestadas,
  aceptadas,
  pct,
  className,
}: {
  presupuestadas: number;
  aceptadas: number;
  /** 0..100, desde `tasaAceptacion`. */
  pct: number;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <ChartTitle align="left" divider sub="presupuestos que el cliente aprobó">
        Aceptación de presupuestos
      </ChartTitle>
      {presupuestadas === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          Sin presupuestos en el período filtrado.
        </p>
      ) : (
        <div
          className="mt-4 flex flex-col items-center"
          title={`${aceptadas} aceptadas de ${presupuestadas} presupuestadas`}
        >
          <svg viewBox="0 0 160 92" className="w-full max-w-[220px]">
            <path
              d="M 16 84 A 64 64 0 0 1 144 84"
              fill="none"
              strokeWidth="12"
              strokeLinecap="round"
              pathLength={100}
              className="stroke-accent-soft"
            />
            <path
              d="M 16 84 A 64 64 0 0 1 144 84"
              fill="none"
              strokeWidth="12"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${Math.min(100, Math.max(0, pct))} 100`}
              className="stroke-accent"
            />
            <text
              x="80"
              y="78"
              textAnchor="middle"
              className="fill-neutral-900 font-semibold"
              style={{ fontSize: "22px" }}
            >
              {Math.round(pct)}%
            </text>
          </svg>
          <p className="mt-2 text-[13px] text-neutral-500">
            <span className="font-semibold tabular-nums text-neutral-900">
              {aceptadas} aceptadas
            </span>{" "}
            / {presupuestadas} presupuestadas
          </p>
        </div>
      )}
    </Card>
  );
}
