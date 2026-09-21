"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { CHART_ACCENT, GHOST_STRIPES } from "@/lib/chart";
import { cn } from "@/lib/utils";
import type { Periodo, RangoEdad } from "@/lib/clientes";

const PERIODOS = [
  { key: "historico", label: "Histórico" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
] as const satisfies { key: Periodo; label: string }[];

/** `data` viene calculado real desde `lib/db/clientes.ts` (`demografiaClientes()`)
 * -- clientes sin `fechaNacimiento` cargada quedan afuera del cálculo. */
export function DemografiaClientes({ data }: { data: Record<Periodo, RangoEdad[]> }) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const rows = data[periodo];
  const axisMax = Math.max(
    30,
    Math.ceil(Math.max(...rows.map((r) => r.pct)) / 10) * 10,
  );

  return (
    <Card className="flex h-auto min-w-0 flex-col p-5 sm:h-72">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <ChartTitle align="left" divider>Demografía de clientes · edad</ChartTitle>
        <div className="inline-flex w-fit self-center rounded-lg bg-neutral-100 p-0.5 sm:self-auto">
          {PERIODOS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                periodo === p.key
                  ? "bg-accent text-white"
                  : "text-neutral-500 hover:text-neutral-700",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.rango} className="flex items-center gap-3 text-sm">
              <span className="w-14 shrink-0 text-neutral-500">{r.rango}</span>
              <div
                className="h-6 min-w-0 flex-1 overflow-hidden rounded-full"
                style={{ background: GHOST_STRIPES }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(r.pct / axisMax) * 100}%`,
                    background: CHART_ACCENT,
                  }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-semibold tabular-nums">
                {r.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
