"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { thDivider } from "@/lib/ui-styles";
import { diaCorto, semanasDelMes } from "@/lib/agenda";
import { turnoBlockClass } from "@/lib/status";
import type { Turno } from "@/lib/types";

const MAX_POR_DIA = 3;

/** Vista Mes: semanas lunes a sábado, hasta 3 turnos por día y «+N más». */
export function CalendarioMes({
  fecha,
  turnos,
  hoy,
  onAbrirTurno,
  onAbrirDia,
}: {
  fecha: string;
  turnos: Turno[];
  hoy: string;
  onAbrirTurno: (id: string) => void;
  onAbrirDia: (fecha: string) => void;
}) {
  const semanas = semanasDelMes(fecha);
  const mes = fecha.slice(0, 7);
  return (
    <Card className="overflow-x-auto p-0">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-6 bg-table-header">
          {semanas[0].map((d, i) => (
            <div
              key={d}
              className={cn(
                "px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-white/70",
                i < 5 && thDivider,
              )}
            >
              {diaCorto(d)}
            </div>
          ))}
        </div>
        {semanas.map((sem) => (
          <div key={sem[0]} className="grid grid-cols-6 border-b border-neutral-100 last:border-b-0">
            {sem.map((d) => {
              const delDia = turnos
                .filter((t) => t.fecha === d && t.estado !== "cancelado")
                .sort((a, b) => a.hora.localeCompare(b.hora));
              return (
                <div
                  key={d}
                  className={cn(
                    "min-h-[104px] border-l border-neutral-100 p-1 first:border-l-0",
                    d.slice(0, 7) !== mes && "bg-neutral-50/70",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onAbrirDia(d)}
                    aria-label={`Abrir el día ${d.slice(8, 10)}/${d.slice(5, 7)}`}
                    className={cn(
                      "mb-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums transition-colors hover:bg-accent-soft",
                      d === hoy ? "bg-accent text-white hover:bg-accent" : "text-neutral-700",
                      d.slice(0, 7) !== mes && d !== hoy && "text-neutral-500",
                    )}
                  >
                    {Number(d.slice(8, 10))}
                  </button>
                  <div className="space-y-0.5">
                    {delDia.slice(0, MAX_POR_DIA).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onAbrirTurno(t.id)}
                        className={cn(
                          "block w-full truncate rounded border px-1 py-0.5 text-left text-[11px] leading-tight",
                          t.estado === "pendiente"
                            ? turnoBlockClass[t.tipo].soft
                            : t.estado === "confirmado"
                              ? turnoBlockClass[t.tipo].solid
                              : "border-neutral-200 bg-neutral-100 text-neutral-500",
                        )}
                      >
                        <span className="tabular-nums">{t.hora}</span> {t.cliente}
                      </button>
                    ))}
                    {delDia.length > MAX_POR_DIA && (
                      <button
                        type="button"
                        onClick={() => onAbrirDia(d)}
                        className="px-1 text-[11px] font-medium text-accent hover:underline"
                      >
                        +{delDia.length - MAX_POR_DIA} más
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}
