"use client";

import { cn } from "@/lib/utils";
import { turnoBlockClass, turnoTipo, turnoStatus } from "@/lib/status";
import { horaFin } from "@/lib/agenda";
import type { Turno } from "@/lib/types";
import { TURNO_ICONO } from "./turno-icono";

/** El color lo da el motivo; el estado cambia la forma (ver CLAUDE.md →
 * Agenda): confirmado fondo claro · sin confirmar borde punteado · atendido /
 * no vino apagado · cancelado punteado y tachado. */
export function claseBloque(t: Pick<Turno, "tipo" | "estado">): string {
  const c = turnoBlockClass[t.tipo];
  switch (t.estado) {
    case "confirmado":
      return c.solid;
    case "pendiente":
      return c.soft;
    case "atendido":
    case "no_vino":
      return "border-neutral-200 bg-neutral-100 text-neutral-500 opacity-70";
    case "cancelado":
      return "border-dashed border-neutral-400 bg-white text-neutral-500 line-through";
  }
}

/** Bloque posicionado en la grilla (ancho/alto/columna los calcula quien lo usa). */
export function EventoBloque({
  turno,
  style,
  detallado,
  onClick,
}: {
  turno: Turno;
  style: React.CSSProperties;
  /** Muestra motivo y atiende cuando el bloque es lo bastante alto. */
  detallado: boolean;
  onClick: () => void;
}) {
  const Icono = TURNO_ICONO[turno.tipo];
  const activo = turno.estado === "confirmado" || turno.estado === "pendiente";
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      title={`${turno.hora}–${horaFin(turno.hora, turno.duracionMin)} · ${turno.cliente} · ${turnoTipo[turno.tipo].label} · ${turnoStatus[turno.estado].label}`}
      className={cn(
        "absolute z-10 overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-xs leading-tight transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        claseBloque(turno),
      )}
    >
      <span className="flex min-w-0 items-center gap-1">
        <Icono
          aria-hidden
          className={cn("h-3 w-3 shrink-0", activo && turnoBlockClass[turno.tipo].icono)}
        />
        <span className="truncate font-semibold">{turno.cliente}</span>
      </span>
      {detallado && (
        <>
          <span className="block truncate text-[11px] opacity-80">
            {turno.hora}–{horaFin(turno.hora, turno.duracionMin)} · {turnoTipo[turno.tipo].label}
          </span>
          {turno.atiende && (
            <span className="block truncate text-[11px] opacity-80">Atiende {turno.atiende}</span>
          )}
        </>
      )}
    </button>
  );
}
