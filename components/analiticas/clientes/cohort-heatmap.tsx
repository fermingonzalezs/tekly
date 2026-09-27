"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { fmtUsd, fmtDateSlash } from "@/lib/format";
import { CHART_TRACK, heatCell } from "@/lib/chart";
import {
  COHORTE_MESES,
  clientesDeCelda,
  mesCorto,
  sumaMeses,
  type ClienteIntel,
  type CohorteFila,
} from "@/lib/clientes-inteligencia";
import { TooltipBox } from "./tooltip";

type Sel = { fila: CohorteFila; m: number };
type HoverCelda = { fila: CohorteFila; m: number } | null;

/** Cohort retention: cada fila es el mes en que un grupo empezó (primera
 *  operación), cada celda el % de ese grupo que operó de nuevo ese mes (una
 *  reparación también es "volver"). M0 = 100% por definición (la primera
 *  operación define la cohorte). Click en una celda → quiénes son. */
export function CohortHeatmap({
  cohortes,
  intel,
}: {
  cohortes: CohorteFila[];
  intel: ClienteIntel[];
}) {
  const [sel, setSel] = useState<Sel | null>(null);
  const [hoverCelda, setHoverCelda] = useState<HoverCelda>(null);

  if (cohortes.length === 0) {
    return (
      <Card className="p-5">
        <ChartTitle align="left" divider sub="% de cada cohorte que volvió a operar cada mes">
          Cohortes de clientes
        </ChartTitle>
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          Sin clientes con operaciones todavía -- no hay cohortes que seguir.
        </p>
      </Card>
    );
  }

  const delSel =
    sel != null ? clientesDeCelda(intel, sel.fila.key, sel.m) : [];

  return (
    <Card className="p-5">
      <ChartTitle
        align="left"
        divider
        sub="filas: mes de la primera operación · celdas: % que volvió a operar · click para ver quiénes"
      >
        Cohortes de clientes
      </ChartTitle>
      <div className="mt-3 overflow-x-auto border-t border-neutral-100 pt-3">
        <div className="min-w-[560px]">
          {/* header */}
          <div className="grid grid-cols-[64px_repeat(8,1fr)] gap-1.5 text-center text-[10px] font-medium text-neutral-400">
            <span />
            {Array.from({ length: COHORTE_MESES + 1 }, (_, m) => (
              <span key={m}>M{m}</span>
            ))}
            <span className="text-right">tamaño</span>
          </div>
          {/* filas: cohortes viejas arriba, la actual abajo */}
          {cohortes.map((fila) => (
            <div
              key={fila.key}
              className="mt-1.5 grid grid-cols-[64px_repeat(8,1fr)] items-center gap-1.5"
            >
              <span className="text-[11px] tabular-nums text-neutral-500">
                {fila.label}
              </span>
              {fila.celdas.map((c, m) => {
                if (c.pct == null) {
                  return (
                    <div
                      key={m}
                      className="h-8 rounded-md border border-dashed border-neutral-100"
                    />
                  );
                }
                // M0 no se colorea: es 100% por definición, no retención
                const cell =
                  m === 0 ? { bg: CHART_TRACK, dark: true } : heatCell(c.pct, 0, 100);
                const esSel = sel?.fila.key === fila.key && sel?.m === m;
                return (
                  <div key={m} className="relative h-8">
                    <button
                      onClick={() =>
                        setSel(esSel ? null : { fila, m })
                      }
                      onMouseEnter={() => setHoverCelda({ fila, m })}
                      onMouseLeave={() => setHoverCelda(null)}
                      className={cn(
                        "h-full w-full rounded-md text-[11px] font-semibold tabular-nums transition-transform hover:scale-[1.04]",
                        cell.dark ? "text-neutral-700" : "text-white",
                        esSel && "ring-2 ring-accent ring-offset-1",
                      )}
                      style={{ background: cell.bg }}
                    >
                      {Math.round(c.pct)}%
                    </button>
                    {hoverCelda?.fila.key === fila.key && hoverCelda.m === m && (
                      <TooltipBox
                        title={`Cohorte ${fila.label}`}
                        rows={[
                          [
                            "Período",
                            `M${m} · ${mesCorto(sumaMeses(fila.key, m))}`,
                          ],
                          ["Tamaño de cohorte", String(fila.iniciales)],
                          ["Volvieron a operar", String(c.retornaron)],
                          ["Retención", `${Math.round(c.pct)}%`],
                        ]}
                        className={cn(
                          "bottom-full mb-2",
                          m >= 4
                            ? "right-0"
                            : "left-1/2 -translate-x-1/2",
                        )}
                      />
                    )}
                  </div>
                );
              })}
              <span className="text-right text-[11px] font-semibold tabular-nums text-neutral-600">
                {fila.iniciales}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">
        Retención por actividad (una reparación también es volver) · el mes en
        curso está a medias -- las cohortes recientes ganan contexto con el tiempo.
      </p>

      {/* drill-down: quiénes son la celda clickeada */}
      {sel && (
        <div className="mt-3 rounded-xl border border-neutral-100 bg-neutral-50/60 p-3">
          <p className="text-[11px] font-medium text-neutral-500">
            Cohorte {sel.fila.label} · M{sel.m} ({mesCorto(sumaMeses(sel.fila.key, sel.m))}) —{" "}
            {delSel.length} {delSel.length === 1 ? "cliente" : "clientes"}
          </p>
          {delSel.length === 0 ? (
            <p className="mt-2 text-xs text-neutral-400">Sin actividad en ese mes.</p>
          ) : (
            <div className="mt-2 space-y-0.5">
              {delSel.map((c) => (
                <Link
                  key={c.id}
                  href={`/clientes?open=${c.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-white"
                >
                  <span className="truncate font-medium text-neutral-800">
                    {c.nombre}
                  </span>
                  <span className="ml-auto shrink-0 text-neutral-400">
                    {c.operaciones} ops
                  </span>
                  <span className="shrink-0 tabular-nums text-neutral-500">
                    {fmtUsd(c.gastadoUsd)}
                  </span>
                  <span className="shrink-0 tabular-nums text-neutral-400">
                    últ. {c.ultimaISO ? fmtDateSlash(c.ultimaISO) : "—"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
