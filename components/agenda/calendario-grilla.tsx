"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { thDivider } from "@/lib/ui-styles";
import {
  HORAS_MEDIA,
  HORA_FIN,
  HORA_INICIO,
  PX_POR_HORA,
  agruparSolapados,
  calcularSolapes,
  diaCorto,
  fechaCorta,
  horaAMinutos,
  minutosAHora,
  etiquetaDia,
} from "@/lib/agenda";
import { EventoBloque } from "./evento-bloque";
import type { Turno } from "@/lib/types";

const ALTO_DIA = (HORA_FIN - HORA_INICIO) * PX_POR_HORA;
const ALTO_SLOT = PX_POR_HORA / 2;
const TZ = "America/Argentina/Buenos_Aires";

/** Minutos desde medianoche en hora argentina (solo en el cliente, para no
 * romper la hidratación). */
function minutosAhora(): number {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const [h, m] = p.split(":").map(Number);
  return h * 60 + m;
}

/** Grilla por media hora, una columna por día. La usan las vistas Día (1
 * columna) y Semana (lunes a sábado). En Semana, 3+ turnos superpuestos se
 * juntan en un bloque «N turnos» que abre ese día. */
export function CalendarioGrilla({
  dias,
  turnos,
  hoy,
  compacta,
  onAgendar,
  onAbrirTurno,
  onAbrirDia,
}: {
  dias: string[];
  turnos: Turno[];
  hoy: string;
  /** Semana: agrupa 3+ solapados y muestra menos detalle. */
  compacta: boolean;
  onAgendar: (fecha: string, hora: string) => void;
  onAbrirTurno: (id: string) => void;
  onAbrirDia: (fecha: string) => void;
}) {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(minutosAhora());
    const t = setInterval(() => setAhora(minutosAhora()), 60_000);
    return () => clearInterval(t);
  }, []);

  const cols = `3.25rem repeat(${dias.length}, minmax(0, 1fr))`;
  const top = (min: number) => ((min - HORA_INICIO * 60) / 60) * PX_POR_HORA;

  return (
    <Card className="overflow-x-auto p-0">
      <div className={compacta ? "min-w-[720px]" : "min-w-[320px]"}>
        <div className="grid bg-table-header" style={{ gridTemplateColumns: cols }}>
          <div className="flex items-center justify-center text-[10px] font-bold uppercase tracking-wide text-white/50">
            Hora
          </div>
          {dias.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => onAbrirDia(d)}
              disabled={!compacta}
              className={cn(
                "px-2 py-2 text-center",
                i < dias.length - 1 && thDivider,
                d === hoy && "bg-white/10",
                compacta && "hover:bg-white/10",
              )}
            >
              <span className="block text-[11px] font-bold uppercase tracking-wide text-white/60">
                {diaCorto(d)}
              </span>
              <span className="block text-sm font-semibold text-white">{fechaCorta(d)}</span>
            </button>
          ))}
        </div>

        <div className="grid" style={{ gridTemplateColumns: cols }}>
          <div className="relative" style={{ height: ALTO_DIA }}>
            {Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => (
              <span
                key={i}
                className="absolute right-2 -translate-y-1/2 text-[11px] font-medium tabular-nums text-neutral-500"
                style={{ top: i * PX_POR_HORA + (i === 0 ? 8 : 0) }}
              >
                {String(HORA_INICIO + i).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {dias.map((fecha) => {
            const delDia = turnos.filter((t) => t.fecha === fecha);
            return (
              <div
                key={fecha}
                className="relative border-l border-neutral-100"
                style={{ height: ALTO_DIA }}
              >
                {/* Huecos de media hora: cada uno agenda en ese horario. */}
                {HORAS_MEDIA.map((h) => (
                  <button
                    key={h}
                    type="button"
                    aria-label={`Agendar el ${fechaCorta(fecha)} a las ${h}`}
                    onClick={() => onAgendar(fecha, h)}
                    className={cn(
                      "group absolute inset-x-0 border-neutral-100 transition-colors hover:bg-accent-soft focus-visible:bg-accent-soft focus-visible:outline-none",
                      h.endsWith(":00") ? "border-t" : "border-t border-dashed",
                    )}
                    style={{ top: top(horaAMinutos(h)), height: ALTO_SLOT }}
                  >
                    <span className="hidden text-[10px] font-medium text-accent group-hover:inline group-focus-visible:inline">
                      + {h}
                    </span>
                  </button>
                ))}

                {agruparSolapados(delDia).flatMap((grupo) => {
                  if (compacta && grupo.length >= 3) {
                    const ini = Math.min(...grupo.map((t) => horaAMinutos(t.hora)));
                    const fin = Math.max(
                      ...grupo.map((t) => horaAMinutos(t.hora) + t.duracionMin),
                    );
                    return [
                      <button
                        key={`g-${grupo[0].id}`}
                        type="button"
                        onClick={() => onAbrirDia(fecha)}
                        title={`${grupo.length} turnos entre ${grupo[0].hora} y ${minutosAHora(fin)}`}
                        style={{
                          top: Math.max(0, top(ini)) + 1,
                          height: Math.max(ALTO_SLOT, ((fin - ini) / 60) * PX_POR_HORA) - 2,
                          left: 2,
                          right: 2,
                        }}
                        className="absolute z-10 rounded-md border border-accent bg-accent-soft px-1.5 py-0.5 text-left text-xs font-semibold text-accent hover:shadow-md"
                      >
                        {grupo.length} turnos
                      </button>,
                    ];
                  }
                  return calcularSolapes(grupo).map(({ evento, col, cols: n }) => {
                    const alto = Math.max(20, (evento.duracionMin / 60) * PX_POR_HORA - 2);
                    return (
                      <EventoBloque
                        key={evento.id}
                        turno={evento}
                        detallado={alto >= 44 && (compacta ? n === 1 : n < 3)}
                        onClick={() => onAbrirTurno(evento.id)}
                        style={{
                          top: Math.max(0, top(horaAMinutos(evento.hora))) + 1,
                          height: alto,
                          left: `calc(${(col / n) * 100}% + 2px)`,
                          width: `calc(${100 / n}% - 4px)`,
                        }}
                      />
                    );
                  });
                })}

                {fecha === hoy &&
                  ahora !== null &&
                  ahora >= HORA_INICIO * 60 &&
                  ahora <= HORA_FIN * 60 && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500"
                      style={{ top: top(ahora) }}
                    >
                      <span className="-mt-[5px] block h-2 w-2 rounded-full bg-red-500" />
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>
      <span className="sr-only">{dias.map(etiquetaDia).join(", ")}</span>
    </Card>
  );
}
