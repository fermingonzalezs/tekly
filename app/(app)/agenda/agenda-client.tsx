"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRealtime } from "@/components/notifications/realtime-provider";
import { AgendarDialog } from "@/components/agenda/agendar-dialog";
import { TurnoDetalle } from "@/components/agenda/turno-detalle";
import { CalendarioGrilla } from "@/components/agenda/calendario-grilla";
import { CalendarioMes } from "@/components/agenda/calendario-mes";
import { Proximos } from "@/components/agenda/proximos";
import {
  etiquetaDia,
  etiquetaRango,
  kpisAgenda,
  moverFecha,
  semanaDe,
  type VistaAgenda,
} from "@/lib/agenda";
import { sumarDias } from "@/lib/date-presets";
import { defaultTurnoSlot } from "@/lib/command-palette";
import { dotClass, turnoTipo } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Celular, ClienteOpcion, OtroItem, Ticket, Turno, TurnoEstado, TurnoTipo } from "@/lib/types";
import type { SessionUser } from "@/lib/auth/types";
import type { Negocio } from "@/lib/db/configuracion";
import {
  createTurnoAction,
  deleteTurnoAction,
  setTurnoEstadoAction,
  updateTurnoAction,
  type TurnoInput,
} from "./actions";

const TIPOS: TurnoTipo[] = ["compra", "deja", "retira", "cotizar"];

type Dialogo = { modo: "nuevo"; fecha: string; hora: string } | { modo: "editar"; id: string };

export function AgendaClient({
  vista,
  fecha,
  hoy,
  turnos,
  proximos,
  celulares,
  otros,
  ticketsListos,
  clientesOpciones,
  atendientes,
  user,
  negocio,
}: {
  vista: VistaAgenda;
  fecha: string;
  hoy: string;
  /** Turnos del rango visible. */
  turnos: Turno[];
  /** Vencidos + próximos 14 días (panel «Próximos» y KPIs). */
  proximos: Turno[];
  celulares: Celular[];
  otros: OtroItem[];
  ticketsListos: Ticket[];
  clientesOpciones: ClienteOpcion[];
  atendientes: { id: string; nombre: string }[];
  user: SessionUser;
  negocio: Negocio;
}) {
  const { publish } = useRealtime();
  const actor = user.nombre;
  const esAdmin = user.rol === "admin";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendiente, startTransition] = useTransition();
  const [selId, setSelId] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [eliminando, setEliminando] = useState<Turno | null>(null);

  // Todo lo conocido, sin duplicados (un turno puede estar en el rango y en próximos).
  const todos = useMemo(
    () => [...new Map([...proximos, ...turnos].map((t) => [t.id, t])).values()],
    [proximos, turnos],
  );
  const sel = selId ? (todos.find((t) => t.id === selId) ?? null) : null;
  const editando = dialogo?.modo === "editar" ? (todos.find((t) => t.id === dialogo.id) ?? null) : null;
  const kpis = kpisAgenda(todos, hoy);

  const navegar = (v: VistaAgenda, f: string) =>
    startTransition(() => router.replace(`/agenda?vista=${v}&fecha=${f}`, { scroll: false }));

  // Mobile: la vista por defecto es Día (la Semana obliga a scrollear de costado).
  useEffect(() => {
    if (!searchParams.get("vista") && window.innerWidth < 768) navegar("dia", fecha);
    // solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ?accion=agendar-turno: el buscador global (CommandPalette) navega acá con
  // ese param; efecto (no useState inicial) para que también ande estando ya
  // parado en /agenda.
  useEffect(() => {
    if (searchParams.get("accion") !== "agendar-turno") return;
    const slot = defaultTurnoSlot();
    setDialogo({ modo: "nuevo", fecha: sumarDias(hoy, slot.dayOffset), hora: slot.hora });
    router.replace(`/agenda?vista=${vista}&fecha=${fecha}`);
  }, [searchParams, router, hoy, vista, fecha]);

  function cambiarEstado(t: Turno, estado: TurnoEstado) {
    startTransition(async () => {
      await setTurnoEstadoAction(t.id, estado);
    });
  }

  function eliminar(t: Turno) {
    setEliminando(null);
    setSelId(null);
    startTransition(async () => {
      await deleteTurnoAction(t.id);
    });
    publish({
      type: "item_deleted",
      actor,
      entity: "Turno",
      label: `${t.cliente} · ${turnoTipo[t.tipo].label}`,
    });
  }

  function guardar(data: TurnoInput) {
    const edit = dialogo?.modo === "editar" ? dialogo.id : null;
    setDialogo(null);
    startTransition(async () => {
      if (edit) {
        await updateTurnoAction(edit, data);
        return;
      }
      const turno = await createTurnoAction(data);
      publish({
        type: "appointment_scheduled",
        actor,
        client: turno.cliente,
        tipoLabel: turnoTipo[data.tipo].label,
        when: `${etiquetaDia(turno.fecha)} · ${turno.hora}`,
      });
    });
  }

  const abrirDia = (f: string) => navegar("dia", f);
  const agendar = (f: string, h: string) => setDialogo({ modo: "nuevo", fecha: f, hora: h });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Turnos hoy" value={kpis.hoy} hint="sin contar cancelados" />
        <StatCard label="Sin confirmar" value={kpis.sinConfirmar} hint="de hoy en adelante" />
        <StatCard label="Esta semana" value={kpis.semana} hint="lunes a sábado" />
        <StatCard
          label="Vencidos sin marcar"
          value={kpis.vencidos}
          hint="pasaron y nadie marcó atendido / no vino"
          valueClassName={kpis.vencidos > 0 ? "text-red-500" : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <IconButton
            aria-label="Anterior"
            icon={ChevronLeft}
            variant="outline"
            onClick={() => navegar(vista, moverFecha(vista, fecha, -1))}
          />
          <Button variant="outline" onClick={() => navegar(vista, hoy)}>
            Hoy
          </Button>
          <IconButton
            aria-label="Siguiente"
            icon={ChevronRight}
            variant="outline"
            onClick={() => navegar(vista, moverFecha(vista, fecha, 1))}
          />
        </div>
        <span className="min-w-[8.5rem] text-sm font-semibold tabular-nums text-neutral-900">
          {etiquetaRango(vista, fecha)}
        </span>
        <Tabs
          value={vista}
          onChange={(v) => navegar(v, fecha)}
          options={[
            { value: "dia", label: "Día" },
            { value: "semana", label: "Semana" },
            { value: "mes", label: "Mes" },
          ]}
        />
        <Button
          icon={Plus}
          variant="primary"
          className="ml-auto"
          onClick={() => setDialogo({ modo: "nuevo", fecha: vista === "dia" ? fecha : hoy, hora: "09:00" })}
        >
          Agendar turno
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
        {TIPOS.map((tp) => (
          <span key={tp} className="inline-flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", dotClass[turnoTipo[tp].tone])} />
            {turnoTipo[tp].label}
          </span>
        ))}
        <span className="text-neutral-500">
          · Lleno: confirmado · Borde: sin confirmar · Apagado: atendido / no vino · Tachado: cancelado
        </span>
      </div>

      <div className={cn("grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]", pendiente && "opacity-60")}>
        <div className="min-w-0">
          {vista === "mes" ? (
            <CalendarioMes
              fecha={fecha}
              turnos={turnos}
              hoy={hoy}
              onAbrirTurno={setSelId}
              onAbrirDia={abrirDia}
            />
          ) : (
            <CalendarioGrilla
              dias={vista === "dia" ? [fecha] : semanaDe(fecha)}
              turnos={turnos}
              hoy={hoy}
              compacta={vista === "semana"}
              onAgendar={agendar}
              onAbrirTurno={setSelId}
              onAbrirDia={abrirDia}
            />
          )}
        </div>
        <Proximos turnos={proximos} hoy={hoy} onAbrirTurno={setSelId} />
      </div>

      <TurnoDetalle
        turno={sel}
        celulares={celulares}
        ticketsListos={ticketsListos}
        clientes={clientesOpciones}
        esAdmin={esAdmin}
        onClose={() => setSelId(null)}
        onEstado={cambiarEstado}
        onEditar={(t) => {
          setSelId(null);
          setDialogo({ modo: "editar", id: t.id });
        }}
        onEliminar={setEliminando}
      />

      <ConfirmDialog
        open={!!eliminando}
        onClose={() => setEliminando(null)}
        onConfirm={() => eliminando && eliminar(eliminando)}
        title="¿Eliminar turno?"
        confirmLabel="Eliminar turno"
      >
        {eliminando &&
          `Se eliminará el turno de «${eliminando.cliente}» (${etiquetaDia(eliminando.fecha)} · ${eliminando.hora}). Esta acción no se puede deshacer.`}
      </ConfirmDialog>

      <AgendarDialog
        key={
          dialogo?.modo === "editar"
            ? `editar-${dialogo.id}`
            : dialogo?.modo === "nuevo"
              ? `nuevo-${dialogo.fecha}-${dialogo.hora}`
              : "agendar-none"
        }
        open={!!dialogo && (dialogo.modo === "nuevo" || !!editando)}
        inicial={dialogo?.modo === "nuevo" ? { fecha: dialogo.fecha, hora: dialogo.hora } : null}
        turno={editando}
        celulares={celulares}
        otros={otros}
        ticketsListos={ticketsListos}
        clientesOpciones={clientesOpciones}
        atendientes={atendientes}
        turnosAgenda={todos}
        negocio={negocio}
        onClose={() => setDialogo(null)}
        onSubmit={guardar}
      />
    </div>
  );
}
