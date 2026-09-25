"use client";

import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { CHART_ACCENT } from "@/lib/chart";
import { fmtUsd } from "@/lib/format";

export type FlujoMes = {
  key: string;
  label: string;
  ingresos: number;
  egresos: number;
  neto: number;
  /** Caja acumulada al cierre del mes (running sum del neto). */
  acumulado: number;
};

/** Flujo de caja por mes con caja acumulada: arriba la línea del
 * acumulado (pendiente = la caja crece/cae/se mantiene), abajo las
 * columnas pareadas ingreso/egreso con el neto del mes. El acumulado va
 * con escala propia arriba en vez de doble eje mezclado con las barras. */
export function FlujoCaja({
  meses,
  className,
}: {
  meses: FlujoMes[];
  className?: string;
}) {
  const maxFlujo = Math.max(1, ...meses.flatMap((m) => [m.ingresos, m.egresos]));
  const minAcum = Math.min(0, ...meses.map((m) => m.acumulado));
  const maxAcum = Math.max(1, ...meses.map((m) => m.acumulado));
  const rangoAcum = Math.max(1, maxAcum - minAcum);
  const n = meses.length;
  const x = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  // fracción 0..1 desde abajo para el acumulado
  const yAcum = (v: number) => (v - minAcum) / rangoAcum;
  const ultimo = meses[n - 1];

  return (
    <Card className={cn("flex h-full flex-col p-5", className)}>
      <ChartTitle align="left" divider sub="cajas, en USD — línea: caja acumulada">
        Flujo de caja por mes
      </ChartTitle>
      {n === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          Sin movimientos en el período filtrado.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Ingresos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              Egresos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ background: CHART_ACCENT }}
              />
              Caja acumulada
            </span>
            {ultimo && (
              <span className="ml-auto text-[11px] font-semibold tabular-nums">
                caja actual:{" "}
                <span className={ultimo.acumulado >= 0 ? "text-emerald-600" : "text-red-500"}>
                  {fmtUsd(ultimo.acumulado)}
                </span>
              </span>
            )}
          </div>

          {/* caja acumulada: escala propia sobre las barras */}
          <div className="relative mt-3 h-12">
            {minAcum < 0 && (
              <div
                className="absolute inset-x-0 border-t border-dashed border-neutral-300"
                style={{ bottom: `${yAcum(0) * 100}%` }}
              />
            )}
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path
                d={meses
                  .map((m, i) => `L ${x(i)} ${100 - yAcum(m.acumulado) * 100}`)
                  .join(" ")
                  .replace("L", "M")}
                fill="none"
                stroke={CHART_ACCENT}
                strokeWidth="2"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {meses.map((m, i) => (
              <span
                key={`a${m.key}`}
                className="absolute h-1.5 w-1.5 -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-white"
                style={{
                  left: `${x(i)}%`,
                  bottom: `${yAcum(m.acumulado) * 100}%`,
                  background: CHART_ACCENT,
                }}
                title={`${m.label}: caja acumulada ${fmtUsd(m.acumulado)}`}
              />
            ))}
          </div>

          {/* `mt-auto` -- pinea las barras al piso de la card, misma altura
              que la de "Compras vs ventas por mes" (al lado, mismo grid
              row): esa card no tiene el bloque de acumulado de arriba, así
              que sin esto sus barras quedaban más arriba que las de acá. */}
          <div className="mt-auto flex items-end gap-3 pt-2 sm:gap-4">
            {meses.map((m) => (
              <div key={m.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div
                  className="flex w-full items-end justify-center gap-1.5"
                  title={`${m.label}: ingresos ${fmtUsd(m.ingresos)} · egresos ${fmtUsd(m.egresos)}`}
                >
                  <div
                    className="w-[38%] rounded-t-md bg-emerald-500"
                    style={{ height: `${Math.max(4, (m.ingresos / maxFlujo) * 140)}px` }}
                  />
                  <div
                    className="w-[38%] rounded-t-md bg-red-400"
                    style={{ height: `${Math.max(4, (m.egresos / maxFlujo) * 140)}px` }}
                  />
                </div>
                <span className="text-xs text-neutral-500">{m.label}</span>
                <span
                  className={cn(
                    "text-[10px] font-medium tabular-nums",
                    m.neto >= 0 ? "text-emerald-600" : "text-red-500",
                  )}
                >
                  {fmtUsd(m.neto)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
