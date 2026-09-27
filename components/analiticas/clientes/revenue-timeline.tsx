"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { Tabs } from "@/components/ui/tabs";
import { fmtUsd } from "@/lib/format";
import { CHART_ACCENT, CHART_COLORS } from "@/lib/chart";
import type { IngresoMes } from "@/lib/clientes-inteligencia";
import { TooltipBox } from "./tooltip";

type Vista = "compras" | "reparaciones" | "total";

const COLOR_NUEVOS = CHART_COLORS[0];
const COLOR_EXISTENTES = CHART_ACCENT;

/** Ingresos por mes separando clientes NUEVOS (primera operación ese mes) de
 *  EXISTENTES -- dice si el mes se apoyó en adquisición o en recurrencia.
 *  Compras = `ventas.totalUsd`, reparaciones = `tickets.presupuestoUsd`
 *  (mismos criterios que el gasto y el tab Reparaciones). */
export function RevenueTimeline({ ingresos }: { ingresos: IngresoMes[] }) {
  const [vista, setVista] = useState<Vista>("total");
  const [hover, setHover] = useState<number | null>(null);

  const valores = ingresos.map((m) =>
    vista === "compras"
      ? { nuevos: m.comprasNuevos, existentes: m.comprasExistentes }
      : vista === "reparaciones"
        ? { nuevos: m.reparacionesNuevos, existentes: m.reparacionesExistentes }
        : { nuevos: m.totalNuevos, existentes: m.totalExistentes },
  );

  const sumNuevos = valores.reduce((a, v) => a + v.nuevos, 0);
  const sumTotal = valores.reduce((a, v) => a + v.nuevos + v.existentes, 0);
  const pctNuevos = sumTotal > 0 ? (sumNuevos / sumTotal) * 100 : 0;

  return (
    <Card className="p-5">
      <ChartTitle
        align="left"
        divider
        sub="ingresos por mes: aporte de clientes nuevos (primera operación ese mes) vs existentes"
      >
        Ingresos: nuevos vs existentes
      </ChartTitle>
      {ingresos.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          Sin ventas ni tickets todavía.
        </p>
      ) : (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Tabs
              value={vista}
              onChange={setVista}
              options={[
                { value: "total" as Vista, label: "Total" },
                { value: "compras" as Vista, label: "Compras" },
                { value: "reparaciones" as Vista, label: "Reparaciones" },
              ]}
            />
            <div className="flex items-center gap-4 text-[11px] text-neutral-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: COLOR_NUEVOS }} />
                nuevos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: COLOR_EXISTENTES }} />
                existentes
              </span>
            </div>
          </div>

          <div className="relative mt-2 h-56">
            {(() => {
              const max = Math.max(1, ...valores.map((v) => Math.max(v.nuevos, v.existentes)));
              const len = valores.length;
              const xPct = (i: number) => (len === 1 ? 50 : 4 + (i * 92) / (len - 1));
              const yPct = (v: number) => 10 + (1 - v / max) * 82;
              const path = (key: "nuevos" | "existentes") =>
                valores
                  .map((v, i) => `${i === 0 ? "M" : "L"} ${xPct(i)} ${yPct(v[key])}`)
                  .join(" ");

              return (
                <>
                  {/* guía al 50% del máximo */}
                  <div
                    className="absolute inset-x-0 border-t border-dashed border-neutral-100"
                    style={{ top: `${yPct(max / 2)}%` }}
                  />
                  <span
                    className="absolute right-0 text-[10px] tabular-nums text-neutral-300"
                    style={{ top: `${yPct(max) - 5}%` }}
                  >
                    {fmtUsd(max)}
                  </span>

                  <svg
                    className="absolute inset-0 h-full w-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <path
                      d={path("existentes")}
                      fill="none"
                      stroke={COLOR_EXISTENTES}
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                    <path
                      d={path("nuevos")}
                      fill="none"
                      stroke={COLOR_NUEVOS}
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>

                  {/* puntos + columnas de hover */}
                  {(() => {
                    const colW = 100 / Math.max(1, len);
                    return valores.map((v, i) => (
                      <div key={ingresos[i].key} className="contents">
                        <span
                          className="absolute h-1.5 w-1.5 -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-white"
                          style={{
                            left: `${xPct(i)}%`,
                            top: `${yPct(v.existentes)}%`,
                            background: COLOR_EXISTENTES,
                          }}
                        />
                        <span
                          className="absolute h-1.5 w-1.5 -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-white"
                          style={{
                            left: `${xPct(i)}%`,
                            top: `${yPct(v.nuevos)}%`,
                            background: COLOR_NUEVOS,
                          }}
                        />
                        <div
                          onMouseEnter={() => setHover(i)}
                          onMouseLeave={() => setHover(null)}
                          className="absolute inset-y-0 cursor-default"
                          style={{
                            left: `${xPct(i) - colW / 2}%`,
                            width: `${colW}%`,
                          }}
                        />
                      </div>
                    ));
                  })()}

                  {/* guía del mes en hover */}
                  {hover != null && (
                    <div
                      className="absolute inset-y-0 border-l border-dashed border-neutral-200"
                      style={{ left: `${xPct(hover)}%` }}
                    />
                  )}

                  {/* tooltip del mes */}
                  {hover != null && (
                    <TooltipMes mes={ingresos[hover]} vista={vista} x={xPct(hover)} />
                  )}

                  {/* etiquetas de meses */}
                  {valores.map((_, i) => {
                    const step = Math.max(1, Math.ceil(len / 6));
                    if (i % step !== 0 && i !== len - 1) return null;
                    return (
                      <span
                        key={ingresos[i].key}
                        className="absolute top-[96%] -translate-x-1/2 text-[10px] tabular-nums text-neutral-400"
                        style={{ left: `${xPct(i)}%` }}
                      >
                        {ingresos[i].label}
                      </span>
                    );
                  })}
                </>
              );
            })()}
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-neutral-400">
            {sumTotal > 0
              ? `${Math.round(pctNuevos)}% de los ingresos del rango vino de clientes nuevos -- el resto, de que los existentes volvieran.`
              : "Sin ingresos en el rango."}
          </p>
        </div>
      )}
    </Card>
  );
}

function TooltipMes({ mes, vista, x }: { mes: IngresoMes; vista: Vista; x: number }) {
  const rows: [string, string][] =
    vista === "compras"
      ? [
          ["Compras de nuevos", fmtUsd(mes.comprasNuevos)],
          ["Compras de existentes", fmtUsd(mes.comprasExistentes)],
          ["Total compras", fmtUsd(mes.compras)],
        ]
      : vista === "reparaciones"
        ? [
            ["Reparaciones de nuevos", fmtUsd(mes.reparacionesNuevos)],
            ["Reparaciones de existentes", fmtUsd(mes.reparacionesExistentes)],
            ["Total reparaciones", fmtUsd(mes.reparaciones)],
          ]
        : [
            ["De nuevos", fmtUsd(mes.totalNuevos)],
            ["De existentes", fmtUsd(mes.totalExistentes)],
            ["Total del mes", fmtUsd(mes.total)],
          ];
  return (
    <TooltipBox
      title={mes.label}
      rows={rows}
      className="capitalize"
      style={
        x > 72
          ? { right: `calc(${100 - x}% + 10px)`, top: 4 }
          : { left: `calc(${x}% + 10px)`, top: 4 }
      }
    />
  );
}
