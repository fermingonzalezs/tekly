"use client";

import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ticketStatus } from "@/lib/status";
import type { FunnelEtapa } from "@/lib/analiticas";

/** Embudo de reparaciones sobre los estados reales del flujo
 * (`TICKET_FLOW`): la barra = tickets que alcanzaron la etapa o más allá,
 * el chip = tickets parados ahí ahora. La caída entre barras consecutivas
 * es dónde se acumula el trabajo. Ancho full: las 7 etapas necesitan
 * lugar para el label + barra + dos números. */
export function FunnelReparaciones({
  etapas,
  className,
}: {
  etapas: FunnelEtapa[];
  className?: string;
}) {
  const base = Math.max(1, etapas[0]?.alcanzados ?? 0);
  const vacio = etapas.every((e) => e.alcanzados === 0);

  return (
    <Card className={cn("p-5", className)}>
      <ChartTitle
        align="left"
        divider
        sub="barras: alcanzaron la etapa · chip: parados ahí ahora"
      >
        Embudo de reparaciones
      </ChartTitle>
      {vacio ? (
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          Sin tickets en el período filtrado.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {etapas.map((e) => {
            const s = ticketStatus[e.estado];
            return (
              <li
                key={e.estado}
                className="flex items-center gap-3"
                title={`${s.label}: ${e.alcanzados} alcanzaron esta etapa · ${e.ahora} parados ahí ahora`}
              >
                <span className="w-24 shrink-0 truncate text-[13px] text-neutral-600 sm:w-32">
                  {s.label}
                </span>
                <div className="h-6 min-w-0 flex-1 overflow-hidden rounded-md bg-accent-soft">
                  <div
                    className="h-6 rounded-md bg-accent"
                    style={{ width: `${(e.alcanzados / base) * 100}%` }}
                  />
                </div>
                <span className="w-7 shrink-0 text-right text-[13px] font-semibold tabular-nums">
                  {e.alcanzados}
                </span>
                <span className="w-9 shrink-0 text-right">
                  {e.ahora > 0 ? (
                    <Badge tone={s.tone}>{e.ahora}</Badge>
                  ) : (
                    <span className="text-[13px] text-neutral-300">—</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
