"use client";

import { Package, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/format";
import { agruparProximos, etiquetaDia, horaFin, type GrupoProximos } from "@/lib/agenda";
import { saldoPedido } from "@/lib/pedidos";
import { pedidoEstado, turnoBlockClass, turnoStatus, turnoTipo } from "@/lib/status";
import type { Pedido, Turno } from "@/lib/types";
import { TURNO_ICONO } from "./turno-icono";

/** Panel «Próximos»: turnos y pedidos abiertos — atrasados (rojo) / hoy /
 * mañana / esta semana / más adelante. Tarjeta estilo sistema-update:
 * horario + tipo arriba, nombre, detalle abajo y un ícono grande de fondo. */
export function Proximos({
  turnos,
  pedidos,
  hoy,
  onAbrirTurno,
  onAbrirPedido,
}: {
  turnos: Turno[];
  /** Pedidos sin entregar (cualquier fecha); se deduplican por id. */
  pedidos: Pedido[];
  hoy: string;
  onAbrirTurno: (id: string) => void;
  onAbrirPedido: (id: string) => void;
}) {
  const grupos = agruparProximos(turnos, hoy, pedidos);
  return (
    <Card className="p-5">
      <ChartTitle align="left" divider sub="Turnos y pedidos: atrasados, hoy y lo que viene">
        Próximos
      </ChartTitle>
      {grupos.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-500">No hay turnos ni pedidos pendientes.</p>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <section key={g.clave}>
              <h3
                className={cn(
                  "mb-1.5 text-[11px] font-semibold uppercase tracking-wider",
                  g.clave === "atrasados" ? "text-red-600" : "text-neutral-500",
                )}
              >
                {g.label} · {g.items.length}
              </h3>
              <ul className="space-y-2">
                {g.items.map((it) => (
                  <li key={`${it.clase}-${it.id}`}>
                    {it.clase === "turno" ? (
                      <TarjetaTurno t={it.turno} grupo={g.clave} onClick={() => onAbrirTurno(it.id)} />
                    ) : (
                      <TarjetaPedido p={it.pedido} grupo={g.clave} onClick={() => onAbrirPedido(it.id)} />
                    )}
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

type Clave = GrupoProximos<Turno>["clave"];

/** Hoy y mañana ya lo dice el grupo; el resto lleva el día. */
const prefijoDia = (grupo: Clave, fecha: string) =>
  grupo === "hoy" || grupo === "manana" ? "" : `${etiquetaDia(fecha)} · `;

function Tarjeta({
  atrasado,
  Icono,
  fondo,
  colorTitulo,
  titulo,
  nombre,
  detalle,
  onClick,
}: {
  atrasado: boolean;
  Icono: LucideIcon;
  fondo: string;
  colorTitulo: string;
  titulo: string;
  nombre: string;
  detalle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={[titulo, nombre, detalle].filter(Boolean).join(" · ")}
      className={cn(
        "relative flex w-full flex-col items-center overflow-hidden rounded-xl border px-3 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        atrasado
          ? "border-2 border-red-400 bg-red-50/40 hover:bg-red-50"
          : "border-neutral-200 bg-white hover:bg-neutral-50",
      )}
    >
      <Icono
        aria-hidden
        strokeWidth={1.5}
        className={cn(
          "pointer-events-none absolute -bottom-3 -right-3 h-16 w-16",
          atrasado ? "text-red-100" : fondo,
        )}
      />
      <span
        className={cn(
          "relative w-full truncate text-xs tabular-nums",
          atrasado ? "text-red-600" : colorTitulo,
        )}
      >
        {atrasado && <span className="font-semibold uppercase">Atrasado · </span>}
        {titulo}
      </span>
      <span className="relative w-full truncate text-base font-medium text-neutral-900">{nombre}</span>
      {detalle && <span className="relative w-full truncate text-xs text-neutral-500">{detalle}</span>}
    </button>
  );
}

function TarjetaTurno({ t, grupo, onClick }: { t: Turno; grupo: Clave; onClick: () => void }) {
  const c = turnoBlockClass[t.tipo];
  // Confirmado es el estado por defecto: solo se avisa si no lo está.
  const estado = t.estado === "confirmado" ? null : turnoStatus[t.estado].label;
  return (
    <Tarjeta
      atrasado={grupo === "atrasados"}
      Icono={TURNO_ICONO[t.tipo]}
      fondo={c.fondo}
      colorTitulo={c.texto}
      titulo={`${prefijoDia(grupo, t.fecha)}${t.hora}–${horaFin(t.hora, t.duracionMin)} · ${turnoTipo[t.tipo].label}`}
      nombre={t.cliente}
      detalle={[estado, t.atiende && `Atiende ${t.atiende}`].filter(Boolean).join(" · ")}
      onClick={onClick}
    />
  );
}

function TarjetaPedido({ p, grupo, onClick }: { p: Pedido; grupo: Clave; onClick: () => void }) {
  const saldo = saldoPedido(p.items, p.senaUsd);
  return (
    <Tarjeta
      atrasado={grupo === "atrasados"}
      Icono={Package}
      fondo="text-neutral-300"
      colorTitulo="text-neutral-600"
      titulo={`${prefijoDia(grupo, p.fechaEntrega)}Todo el día · Pedido${p.estado === "llego" ? ` · ${pedidoEstado.llego.label}` : ""}`}
      nombre={p.cliente}
      detalle={[p.descripcion, saldo > 0 && `resta ${fmtUsd(saldo)}`].filter(Boolean).join(" · ")}
      onClick={onClick}
    />
  );
}
