"use client";

import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { chartColor } from "@/lib/chart";
import { fmtUsd } from "@/lib/format";
import type { MargenPorTipo } from "@/lib/analiticas";

/** Scatter margen vs facturación: un punto por rubro -- X = facturación
 * con costo cargado, Y = margen %, tamaño = ganancia. Volumen (derecha)
 * contra rentabilidad (arriba) de un vistazo. Rubros sin facturación con
 * costo no aparecen: sin costo cargado el margen no es calculable, y
 * plottedlo en 0 sería inventarlo. Mismo color por rubro que el resto de
 * la sección (`chartColor` sobre `RUBRO_ORDEN`, el orden en el que
 * `margenPorTipo` devuelve las filas). */
export function ScatterMargen({
  rows,
  className,
}: {
  rows: MargenPorTipo[];
  className?: string;
}) {
  const puntos = rows
    .map((r, i) => ({ ...r, i }))
    .filter((r) => r.facturacionUsd > 0);
  const maxX = Math.max(1, ...puntos.map((p) => p.facturacionUsd));
  const minY = Math.min(0, ...puntos.map((p) => p.margenPct));
  const maxY = Math.max(10, ...puntos.map((p) => p.margenPct));
  const rangoY = maxY - minY || 1;
  const maxGan = Math.max(1, ...puntos.map((p) => p.gananciaUsd));

  // El punto de mayor facturación/margen cae justo en el 100% del eje --
  // sin aire reservado, su radio y su label quedan literalmente afuera del
  // cuadro (la parte de arriba/derecha se corta contra el borde de la
  // card). Se reserva margen en los 4 bordes y todo el mapeo de
  // coordenadas pasa por estas dos funciones en vez de `x/max*100`
  // directo. `minY` también cubre un rubro que diera pérdida (margen
  // negativo, hoy no pasa pero es un dato real posible): sin esto el
  // punto se plotea por debajo del 0% y desaparece del cuadro.
  const xToPct = (v: number) => 8 + (v / maxX) * 84;
  const yToPct = (v: number) => 8 + ((v - minY) / rangoY) * 70;

  return (
    <Card className={cn("p-5", className)}>
      <ChartTitle align="left" divider sub="tamaño del punto = ganancia, por tipo de operación">
        Margen vs facturación
      </ChartTitle>
      {puntos.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          Sin ventas con costo cargado en el período filtrado.
        </p>
      ) : (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <div className="relative h-56">
            {/* grilla horizontal con labels de margen % */}
            {[0.25, 0.5, 0.75].map((f) => {
              const valor = minY + f * rangoY;
              return (
                <div
                  key={f}
                  className="absolute inset-x-0 border-t border-dashed border-neutral-100"
                  style={{ bottom: `${yToPct(valor)}%` }}
                />
              );
            })}
            {[0.25, 0.5, 0.75].map((f) => {
              const valor = minY + f * rangoY;
              return (
                <span
                  key={`l${f}`}
                  className="absolute text-[10px] tabular-nums text-neutral-400"
                  style={{ bottom: `calc(${yToPct(valor)}% - 4px)`, left: 2 }}
                >
                  {Math.round(valor)}%
                </span>
              );
            })}
            {/* línea de referencia en 0% -- solo tiene sentido marcarla si
                hay algún rubro con margen negativo (pérdida): ahí es donde
                un punto por debajo distingue "vendiendo a pérdida". */}
            {minY < 0 && (
              <div
                className="absolute inset-x-0 border-t border-neutral-300"
                style={{ bottom: `${yToPct(0)}%` }}
              />
            )}

            {puntos.map((p) => {
              const d = 14 + Math.round(18 * Math.sqrt(p.gananciaUsd / maxGan)); // Ø px
              const left = xToPct(p.facturacionUsd);
              const bottom = yToPct(p.margenPct);
              return (
                <div key={p.tipo} className="contents">
                  <span
                    className="absolute -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-white"
                    style={{
                      left: `${left}%`,
                      bottom: `${bottom}%`,
                      width: d,
                      height: d,
                      background: chartColor(p.i),
                    }}
                    title={`${p.tipo}: facturación ${fmtUsd(p.facturacionUsd)} · margen ${p.margenPct.toFixed(1)}% · ganancia ${fmtUsd(p.gananciaUsd)} · ${p.operaciones} operaciones`}
                  />
                  <span
                    className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-neutral-600"
                    style={{ left: `${left}%`, bottom: `calc(${bottom}% + ${d / 2 + 4}px)` }}
                  >
                    {p.tipo}
                  </span>
                </div>
              );
            })}
          </div>

          {/* eje X: facturación */}
          <div className="relative mt-1 border-t border-neutral-200 pt-1 text-[10px] tabular-nums text-neutral-400">
            <span className="absolute left-0">0</span>
            <span className="absolute left-1/2 -translate-x-1/2">{fmtUsd(Math.round(maxX / 2))}</span>
            <span className="absolute right-0">{fmtUsd(maxX)}</span>
            <span className="sr-only">facturación</span>
          </div>
        </div>
      )}
    </Card>
  );
}
