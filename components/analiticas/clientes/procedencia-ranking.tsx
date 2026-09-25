"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { fmtUsd, fmtNum } from "@/lib/format";
import {
  SIN_PROCEDENCIA,
  type ProcedenciaRow,
} from "@/lib/clientes-inteligencia";

/** Ranking de canales de adquisición (procedencia de la primera venta de cada
 *  cliente). Dos vistas sobre los mismos canales: por clientes y por valor
 *  generado -- el canal que más clientes trae no es necesariamente el que
 *  más valor deja. Click en un canal filtra el mapa de valor (y este
 *  ranking); click de nuevo lo suelta. */
export function ProcedenciaRanking({
  ranking,
  filtro,
  onFiltro,
  colorDe,
}: {
  ranking: ProcedenciaRow[];
  /** Canal seleccionado (label de la fila) o null. */
  filtro: string | null;
  onFiltro: (f: string | null) => void;
  colorDe: (procedencia: string | null) => string;
}) {
  const [vista, setVista] = useState<"clientes" | "valor">("clientes");

  const filas =
    vista === "clientes"
      ? ranking
      : [...ranking].sort((a, b) => b.valorUsd - a.valorUsd);
  const max = Math.max(
    1,
    ...filas.map((f) => (vista === "clientes" ? f.clientes : f.valorUsd)),
  );

  return (
    <Card className="p-5">
      <ChartTitle
        align="left"
        divider
        sub="canal de adquisición: procedencia de la primera venta de cada cliente"
      >
        Clientes por canal
      </ChartTitle>
      {ranking.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          Sin clientes todavía.
        </p>
      ) : (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <Tabs
            value={vista}
            onChange={setVista}
            options={[
              { value: "clientes" as const, label: "Clientes" },
              { value: "valor" as const, label: "Ingresos" },
            ]}
          />
          <div className="mt-3 space-y-1">
            {filas.map((f) => {
              const activo = filtro === f.label;
              const w =
                ((vista === "clientes" ? f.clientes : f.valorUsd) / max) * 100;
              return (
                <button
                  key={f.label}
                  onClick={() => onFiltro(activo ? null : f.label)}
                  className={cn(
                    "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                    activo
                      ? "border-accent bg-accent-soft"
                      : "border-transparent hover:border-neutral-200",
                  )}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: colorDe(f.label === SIN_PROCEDENCIA ? null : f.label) }}
                    />
                    <span className="truncate font-medium text-neutral-800">
                      {f.label === SIN_PROCEDENCIA ? "Sin dato" : f.label}
                    </span>
                    <span className="ml-auto shrink-0 font-semibold tabular-nums text-neutral-800">
                      {vista === "clientes" ? fmtNum(f.clientes) : fmtUsd(f.valorUsd)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${w}%`, background: colorDe(f.label === SIN_PROCEDENCIA ? null : f.label) }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-neutral-400">
                    {Math.round(f.pct)}% de los clientes
                    {vista === "clientes"
                      ? ` · generó ${fmtUsd(f.valorUsd)}`
                      : ` · ${fmtNum(f.clientes)} clientes`}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">
            El canal con más clientes no es necesariamente el que más genera --
            compará las dos vistas. Click filtra el mapa de valor.
          </p>
        </div>
      )}
    </Card>
  );
}
