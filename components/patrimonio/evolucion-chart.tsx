"use client";

import { useState } from "react";
import { GraficoCard } from "@/components/ui/grafico-card";
import { cn } from "@/lib/utils";
import { CHART_ACCENT, CHART_TRACK, fmtUsdCompact, ticksEje } from "@/lib/chart";
import { fmtDateSlash, fmtUsd } from "@/lib/format";
import type { PuntoMensual } from "@/lib/patrimonio-historial";

/** «Patrimonio neto — últimos 12 meses»: una línea con un punto por mes (la
 *  última foto de cada mes; el mes en curso muestra la de hoy). Un solo hue
 *  (`CHART_ACCENT`); el tooltip trae activo y pasivo. Con 1 punto no hay línea
 *  que dibujar: se muestra el punto y el aviso de que el historial recién
 *  arranca. */
export function EvolucionPatrimonio({
  puntos,
  desdeFoto,
}: {
  puntos: PuntoMensual[];
  desdeFoto: string | null;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = puntos.length;

  const sub = desdeFoto
    ? `Historial desde el ${fmtDateSlash(desdeFoto)} · una foto por día`
    : "Todavía no hay historial";

  if (n === 0) {
    return (
      <GraficoCard title="Evolución del patrimonio neto" sub={sub}>
        <p className="px-4 text-center text-sm text-neutral-500">
          Se empieza a armar con la primera visita a esta pantalla.
        </p>
      </GraficoCard>
    );
  }

  const valores = puntos.map((p) => p.patrimonioUsd);
  const minV = Math.min(0, ...valores);
  const maxV = Math.max(1, ...valores);
  const ticks = ticksEje(maxV);
  const top = ticks[ticks.length - 1];
  const rango = top - minV || 1;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - ((v - minV) / rango) * 100;
  const linea = puntos.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.patrimonioUsd)}`).join(" ");
  const area = n > 1 ? `${linea} L ${x(n - 1)} 100 L ${x(0)} 100 Z` : "";
  const puntoHover = hover !== null ? puntos[hover] : null;

  return (
    <GraficoCard title="Evolución del patrimonio neto" sub={sub}>
      <div className="flex h-full min-h-[120px] flex-col gap-1.5 pt-1">
        <div className="relative flex min-h-0 flex-1" onMouseLeave={() => setHover(null)}>
          {/* Eje Y alineado con las líneas guía */}
          <div className="relative w-12 shrink-0 text-[10px] tabular-nums text-neutral-500">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute left-0 -translate-y-1/2"
                style={{ top: `${y(t)}%` }}
              >
                {t === 0 ? "U$ 0" : fmtUsdCompact(t)}
              </span>
            ))}
          </div>

          <div className="relative min-w-0 flex-1">
            {ticks.map((t) => (
              <div
                key={t}
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 border-t border-neutral-100"
                style={{ top: `${y(t)}%` }}
              />
            ))}

            {n > 1 && (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="patrimonioFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_ACCENT} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={CHART_ACCENT} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={area} fill="url(#patrimonioFill)" />
                <path
                  d={linea}
                  fill="none"
                  stroke={CHART_ACCENT}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}

            {/* marcadores (círculo 8px blanco con borde del color) */}
            {puntos.map((p, i) => (
              <span
                key={p.clave}
                className={cn(
                  "pointer-events-none absolute z-10 -translate-x-1/2 translate-y-1/2 rounded-full border-2 bg-white transition-all",
                  hover === i ? "h-3 w-3" : "h-2 w-2",
                )}
                style={{
                  left: `${x(i)}%`,
                  bottom: `${100 - y(p.patrimonioUsd)}%`,
                  borderColor: CHART_ACCENT,
                  opacity: hover === null || hover === i ? 1 : 0.6,
                }}
              />
            ))}

            {/* columnas de hover, una por mes */}
            <div className="absolute inset-0 flex">
              {puntos.map((p, i) => (
                <div
                  key={p.clave}
                  className="h-full flex-1"
                  onMouseEnter={() => setHover(i)}
                />
              ))}
            </div>

            {puntoHover && (
              <div
                className={cn(
                  "pointer-events-none absolute top-2 z-20 whitespace-nowrap rounded-lg bg-neutral-900 px-3 py-2 text-xs text-white shadow-lg",
                  hover! > (n - 1) / 2 ? "-translate-x-full -ml-3" : "ml-3",
                )}
                style={{ left: `${x(hover!)}%` }}
              >
                <p className="text-center font-semibold">
                  {puntoHover.label}
                  {puntoHover.enCurso ? " · hoy" : ` · ${fmtDateSlash(puntoHover.fecha)}`}
                </p>
                <p className="mt-1 flex items-center gap-1.5 tabular-nums">
                  <span className="h-2 w-2 rounded-sm" style={{ background: CHART_ACCENT }} />
                  Neto
                  <span className="ml-auto pl-3 font-semibold">{fmtUsd(puntoHover.patrimonioUsd)}</span>
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 tabular-nums">
                  <span className="h-2 w-2 rounded-sm" style={{ background: CHART_TRACK }} />
                  Activo
                  <span className="ml-auto pl-3 font-semibold">{fmtUsd(puntoHover.activoUsd)}</span>
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 tabular-nums">
                  <span className="h-2 w-2 rounded-sm bg-neutral-500" />
                  Pasivo
                  <span className="ml-auto pl-3 font-semibold">{fmtUsd(puntoHover.pasivoUsd)}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Eje X: mes de cada punto */}
        <div className="relative ml-12 h-4">
          {puntos.map((p, i) => (
            <span
              key={p.clave}
              className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] tabular-nums text-neutral-500"
              style={{ left: `${x(i)}%` }}
            >
              {n > 8 ? p.label.slice(0, 3) : p.label}
            </span>
          ))}
        </div>
      </div>
    </GraficoCard>
  );
}
