"use client";

import { useState } from "react";
import { GraficoCard } from "@/components/ui/grafico-card";
import { CHART_ACCENT } from "@/lib/chart";
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
    <GraficoCard
      title="Demografía de clientes · edad"
      action={
        <div className="inline-flex w-fit shrink-0 self-start rounded-lg bg-neutral-100 p-0.5">
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
      }
    >
      <div className="flex flex-1 flex-col justify-center">
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.rango} className="flex items-center gap-3 text-sm">
              <span className="w-14 shrink-0 text-neutral-500">{r.rango}</span>
              <div className="h-6 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
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
    </GraficoCard>
  );
}
