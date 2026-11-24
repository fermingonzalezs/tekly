"use client";

import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { agruparProximos, etiquetaDia, horaFin } from "@/lib/agenda";
import { dotClass, turnoStatus, turnoTipo } from "@/lib/status";
import type { Turno } from "@/lib/types";

/** Panel «Próximos»: vencidos (rojo) / hoy / mañana / esta semana / más adelante. */
export function Proximos({
  turnos,
  hoy,
  onAbrirTurno,
}: {
  turnos: Turno[];
  hoy: string;
  onAbrirTurno: (id: string) => void;
}) {
  const grupos = agruparProximos(turnos, hoy);
  return (
    <Card className="p-5">
      <ChartTitle align="left" divider sub="Vencidos, hoy y los próximos 14 días">
        Próximos
      </ChartTitle>
      {grupos.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-500">No hay turnos pendientes.</p>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <section key={g.clave}>
              <h3
                className={cn(
                  "mb-1.5 text-[11px] font-semibold uppercase tracking-wider",
                  g.clave === "vencidos" ? "text-red-600" : "text-neutral-500",
                )}
              >
                {g.label} · {g.turnos.length}
              </h3>
              <ul className="space-y-1.5">
                {g.turnos.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onAbrirTurno(t.id)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 text-left transition-colors hover:bg-neutral-50",
                        g.clave === "vencidos"
                          ? "border-red-200 bg-red-50/60 hover:bg-red-50"
                          : "border-neutral-200",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-neutral-900">
                          {t.cliente}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                          {g.clave === "hoy" || g.clave === "manana" ? "" : `${etiquetaDia(t.fecha)} · `}
                          {t.hora}–{horaFin(t.hora, t.duracionMin)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={cn("h-1.5 w-1.5 rounded-full", dotClass[turnoTipo[t.tipo].tone])} />
                          {turnoTipo[t.tipo].label}
                        </span>
                        <span>· {turnoStatus[t.estado].label}</span>
                        {t.atiende && <span className="truncate">· {t.atiende}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
