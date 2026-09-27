"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { fmtUsd, fmtDateSlash } from "@/lib/format";
import { SIN_PROCEDENCIA, type ClienteIntel } from "@/lib/clientes-inteligencia";
import { TooltipBox } from "./tooltip";

/** Cuántos clientes se grafican individualmente -- con miles de clientes el
 *  mapa se vuelve una mancha y el navegador arrastra miles de nodos. Los de
 *  menor gasto son los que menos dicen del valor: se muestran los MAX_PUNTOS
 *  de mayor gasto y se informa cuántos quedaron afuera (mismo criterio que
 *  `StockBubble`). Los KPIs nunca se ven afectados por este recorte. */
const MAX_PUNTOS = 220;

type Hover = { cliente: ClienteIntel; left: number; bottom: number; d: number };

/** El mapa de valor de clientes: un punto por cliente -- X = operaciones
 *  (compras + reparaciones), Y = gasto total, tamaño = antigüedad desde la
 *  primera operación, color = canal de adquisición (procedencia de su
 *  primera venta). Sin etiquetas sobre los puntos: el dato completo va en el
 *  tooltip de hover. Click → ficha del cliente. Clientes sin operaciones no
 *  aparecen (no hay actividad que mapear). */
export function ValueMap({
  intel,
  filtro,
  colorDe,
}: {
  intel: ClienteIntel[];
  /** Canal seleccionado en el ranking de procedencia (filtra el mapa). */
  filtro: string | null;
  /** Color por canal de adquisición (null = "Sin dato", gris). */
  colorDe: (procedencia: string | null) => string;
}) {
  const [hover, setHover] = useState<Hover | null>(null);

  const conOps = intel.filter((c) => c.operaciones > 0);
  const visibles = [...conOps].sort((a, b) => b.gastadoUsd - a.gastadoUsd).slice(0, MAX_PUNTOS);
  const ocultos = conOps.length - visibles.length;
  const sinOps = intel.length - conOps.length;

  const maxX = Math.max(1, ...visibles.map((c) => c.operaciones));
  const maxY = Math.max(1, ...visibles.map((c) => c.gastadoUsd));
  const maxAnt = Math.max(1, ...visibles.map((c) => c.antiguedadDias ?? 0));

  // margen de aire en los 4 bordes (mismo criterio que ScatterMargen): sin
  // esto el punto más extremo cae contra el borde de la card
  const xToPct = (v: number) => 5 + (v / maxX) * 89;
  const yToPct = (v: number) => 8 + (v / maxY) * 78;

  const canalDe = (c: ClienteIntel) => c.procedencia ?? SIN_PROCEDENCIA;
  const canales = [...new Set(visibles.map(canalDe))]
    .map((label) => ({
      label,
      color: colorDe(label === SIN_PROCEDENCIA ? null : label),
      clientes: visibles.filter((c) => canalDe(c) === label).length,
    }))
    .sort((a, b) => b.clientes - a.clientes);

  return (
    <Card className="p-5">
      <ChartTitle
        align="left"
        divider
        sub="X: operaciones · Y: gasto total · tamaño: antigüedad · color: canal de adquisición · click abre la ficha"
      >
        Customer value map
      </ChartTitle>
      {visibles.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          Sin clientes con operaciones todavía -- el mapa necesita actividad.
        </p>
      ) : (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <div className="relative h-80">
            {/* grilla horizontal de referencia */}
            {[0.25, 0.5, 0.75].map((f) => (
              <div
                key={f}
                className="absolute inset-x-8 border-t border-dashed border-neutral-100"
                style={{ bottom: `${yToPct(maxY * f)}%` }}
              />
            ))}
            {/* ticks de gasto (eje Y) */}
            {[0, 0.5, 1].map((f) => (
              <span
                key={f}
                className="absolute text-[10px] tabular-nums text-neutral-400"
                style={{ bottom: `calc(${yToPct(maxY * f)}% - 6px)`, left: 6 }}
              >
                {f === 0.5 ? fmtUsd(Math.round(maxY / 2)) : f === 1 ? fmtUsd(Math.round(maxY)) : "0"}
              </span>
            ))}

            {filtro && (
              <p className="absolute right-2 top-1 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-neutral-700">
                {filtro === SIN_PROCEDENCIA ? "Sin dato" : filtro}
              </p>
            )}

            {visibles.map((c) => {
              const d = 10 + Math.round(24 * Math.sqrt((c.antiguedadDias ?? 0) / maxAnt)); // Ø px
              const left = xToPct(c.operaciones);
              const bottom = yToPct(c.gastadoUsd);
              const coincide = !filtro || canalDe(c) === filtro;
              const esHover = hover?.cliente.id === c.id;
              return (
                <Link
                  key={c.id}
                  href={`/clientes?open=${c.id}`}
                  onMouseEnter={() => setHover({ cliente: c, left, bottom, d })}
                  onMouseLeave={() => setHover((h) => (h?.cliente.id === c.id ? null : h))}
                  className={cn(
                    "absolute -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-white transition-all duration-150 hover:z-20 hover:scale-125",
                    coincide ? "opacity-75 hover:opacity-100" : "opacity-[0.12]",
                  )}
                  style={{
                    left: `${left}%`,
                    bottom: `${bottom}%`,
                    width: d,
                    height: d,
                    background: colorDe(c.procedencia),
                    zIndex: esHover ? 20 : undefined,
                  }}
                />
              );
            })}

            {hover && (
              <TooltipBox
                title={hover.cliente.nombre}
                rows={[
                  ["Operaciones", String(hover.cliente.operaciones)],
                  ["Compras", String(hover.cliente.compras)],
                  ["Reparaciones", String(hover.cliente.reparaciones)],
                  ["Gasto", fmtUsd(hover.cliente.gastadoUsd)],
                  [
                    "Última operación",
                    hover.cliente.ultimaISO ? fmtDateSlash(hover.cliente.ultimaISO) : "—",
                  ],
                  ["Canal", canalDe(hover.cliente)],
                ]}
                style={{
                  left: hover.left > 70 ? undefined : `calc(${hover.left}% + 12px)`,
                  right: hover.left > 70 ? `calc(${100 - hover.left}% + 12px)` : undefined,
                  top:
                    hover.bottom > 72
                      ? `calc(${100 - hover.bottom}% + ${hover.d / 2 + 6}px)`
                      : undefined,
                  bottom:
                    hover.bottom > 72
                      ? undefined
                      : `calc(${hover.bottom}% + ${hover.d / 2 + 6}px)`,
                }}
              />
            )}
          </div>

          {/* eje X: operaciones */}
          <div className="relative mt-1 border-t border-neutral-200 pt-1 text-[10px] tabular-nums text-neutral-400">
            <span className="absolute left-1">0</span>
            <span className="absolute left-1/2 -translate-x-1/2">{Math.round(maxX / 2)}</span>
            <span className="absolute right-1">{maxX}</span>
            <span className="sr-only">operaciones</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-neutral-500">
            {canales.slice(0, 6).map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                {c.label === SIN_PROCEDENCIA ? "Sin dato" : c.label}
              </span>
            ))}
            {ocultos > 0 && (
              <span className="text-neutral-400">
                +{ocultos} de menor gasto no mostrados
              </span>
            )}
            {sinOps > 0 && (
              <span className="text-neutral-400">{sinOps} sin operaciones, fuera del mapa</span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
