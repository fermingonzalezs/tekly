"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { clientesDemografia } from "@/lib/mock-data";
import { CHART_ACCENT, GHOST_STRIPES } from "@/lib/chart";
import { cn } from "@/lib/utils";

const PERIODOS = [
  { key: "historico", label: "Histórico" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
] as const;
type Periodo = (typeof PERIODOS)[number]["key"];

export function DemografiaClientes() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const rows = clientesDemografia[periodo];
  const axisMax = Math.max(
    30,
    Math.ceil(Math.max(...rows.map((r) => r.pct)) / 10) * 10,
  );
  const ticks = Array.from({ length: axisMax / 10 + 1 }, (_, i) => i * 10);

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <ChartTitle align="left" divider>Demografía de clientes · edad</ChartTitle>
        <div className="inline-flex rounded-lg bg-neutral-100 p-0.5">
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
                className="h-6 flex-1 overflow-hidden rounded-full"
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

        <div className="mt-2 flex items-center gap-3 text-[11px] text-neutral-400">
          <span className="w-14 shrink-0" />
          <div className="flex flex-1 justify-between">
            {ticks.map((t) => (
              <span key={t}>{t}%</span>
            ))}
          </div>
          <span className="w-10 shrink-0" />
        </div>
      </div>
    </Card>
  );
}
