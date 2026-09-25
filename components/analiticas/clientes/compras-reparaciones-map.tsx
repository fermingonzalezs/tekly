"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/format";
import { SIN_PROCEDENCIA, type ClienteIntel } from "@/lib/clientes-inteligencia";
import { TooltipBox } from "./tooltip";

/** Mismo tope que el value map (ver nota ahí) -- son los mismos clientes. */
const MAX_PUNTOS = 220;

type Hover = { cliente: ClienteIntel; left: number; bottom: number; d: number };

/** Compras vs reparaciones: el cruce que define este CRM (venta + taller).
 *  X = compras, Y = reparaciones, tamaño = gasto, color = canal (mismos
 *  colores que el value map). Las 4 zonas son guías visuales, no una
 *  clasificación: se dividen por la mediana de compras y de reparaciones
 *  de los clientes graficados ("muchas/muchas" es relativo a la base real
 *  del negocio). Click → ficha del cliente. */
export function ComprasReparacionesMap({
  intel,
  filtro,
  colorDe,
}: {
  intel: ClienteIntel[];
  filtro: string | null;
  colorDe: (procedencia: string | null) => string;
}) {
  const [hover, setHover] = useState<Hover | null>(null);

  const conOps = intel.filter((c) => c.operaciones > 0);
  const visibles = [...conOps].sort((a, b) => b.gastadoUsd - a.gastadoUsd).slice(0, MAX_PUNTOS);
  const ocultos = conOps.length - visibles.length;

  const comprasOrdenadas = visibles.map((c) => c.compras).sort((a, b) => a - b);
  const reparOrdenadas = visibles.map((c) => c.reparaciones).sort((a, b) => a - b);
  const medCompras = comprasOrdenadas[Math.floor((comprasOrdenadas.length - 1) / 2)] ?? 0;
  const medReparaciones = reparOrdenadas[Math.floor((reparOrdenadas.length - 1) / 2)] ?? 0;

  const maxX = Math.max(1, ...visibles.map((c) => c.compras));
  const maxY = Math.max(1, ...visibles.map((c) => c.reparaciones));
  const maxGasto = Math.max(1, ...visibles.map((c) => c.gastadoUsd));

  const xToPct = (v: number) => 6 + (v / maxX) * 88;
  const yToPct = (v: number) => 8 + (v / maxY) * 78;

  const canalDe = (c: ClienteIntel) => c.procedencia ?? SIN_PROCEDENCIA;

  return (
    <Card className="p-5">
      <ChartTitle
        align="left"
        divider
        sub="X: compras · Y: reparaciones · tamaño: gasto · zonas por mediana (guía, no clasificación)"
      >
        Compras vs reparaciones
      </ChartTitle>
      {visibles.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          Sin clientes con operaciones todavía.
        </p>
      ) : (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <div className="relative h-64">
            {/* divisiones de zona: medianas de compras y reparaciones */}
            <div
              className="absolute inset-y-0 border-l border-dashed border-neutral-200"
              style={{ left: `${xToPct(medCompras)}%` }}
            />
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap bg-white px-1 text-[10px] tabular-nums text-neutral-400"
              style={{ left: `${xToPct(medCompras)}%`, top: -2 }}
            >
              mediana {medCompras}
            </span>
            <div
              className="absolute inset-x-0 border-t border-dashed border-neutral-200"
              style={{ bottom: `${yToPct(medReparaciones)}%` }}
            />
            <span
              className="absolute -translate-y-1/2 whitespace-nowrap bg-white px-1 text-[10px] tabular-nums text-neutral-400"
              style={{ bottom: `${yToPct(medReparaciones)}%`, left: 2 }}
            >
              mediana {medReparaciones}
            </span>

            {/* zonas: guías visuales, no clasificación */}
            <span className="absolute bottom-1.5 left-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-300">
              ocasionales
            </span>
            <span className="absolute bottom-1.5 right-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-300">
              compradores
            </span>
            <span className="absolute left-1.5 top-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-300">
              técnicos
            </span>
            <span className="absolute right-1.5 top-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-300">
              completos
            </span>

            {visibles.map((c) => {
              const d = 10 + Math.round(24 * Math.sqrt(c.gastadoUsd / maxGasto)); // Ø px
              const left = xToPct(c.compras);
              const bottom = yToPct(c.reparaciones);
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
                  ["Compras", String(hover.cliente.compras)],
                  ["Reparaciones", String(hover.cliente.reparaciones)],
                  ["Gasto", fmtUsd(hover.cliente.gastadoUsd)],
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

          <div className="relative mt-1 border-t border-neutral-200 pt-1 text-[10px] tabular-nums text-neutral-400">
            <span className="absolute left-1">0 compras</span>
            <span className="absolute right-1">{maxX} compras</span>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-400">
            Arriba = más reparaciones{ocultos > 0 && ` · +${ocultos} de menor gasto no mostrados`}
          </p>
        </div>
      )}
    </Card>
  );
}
