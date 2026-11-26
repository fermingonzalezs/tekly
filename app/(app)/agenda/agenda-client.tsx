"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Package, Plus } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRealtime } from "@/components/notifications/realtime-provider";
import { AgendarDialog } from "@/components/agenda/agendar-dialog";
import { TurnoDetalle, textoParaCliente } from "@/components/agenda/turno-detalle";
import { CalendarioGrilla } from "@/components/agenda/calendario-grilla";
import { CalendarioMes } from "@/components/agenda/calendario-mes";
import { Proximos } from "@/components/agenda/proximos";
import { PedidoDetalle, PedidoDialog } from "@/components/agenda/pedido-dialog";
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
import { turnoBlockClass, turnoTipo } from "@/lib/status";
import { TURNO_ICONO } from "@/components/agenda/turno-icono";
import { cn } from "@/lib/utils";
import type {
  Caja,
  Celular,
  ClienteOpcion,
  OtroItem,
  Pedido,
  PedidoEstado,
  Ticket,
  Tienda,
  Turno,
  TurnoEstado,
  TurnoTipo,
} from "@/lib/types";
import type { SessionUser } from "@/lib/auth/types";
import { tieneRol } from "@/lib/roles";
import type { Negocio } from "@/lib/db/configuracion";
import {
  createPedidoAction,
  createTurnoAction,
  deletePedidoAction,
  deleteTurnoAction,
  setPedidoEstadoAction,
  setTurnoEstadoAction,
  updatePedidoAction,
  updateTurnoAction,
  type PedidoInput,
  type TurnoInput,
} from "./actions";

const TIPOS: TurnoTipo[] = ["compra", "deja", "retira", "cotizar", "otro"];

type Dialogo = { modo: "nuevo"; fecha: string; hora: string } | { modo: "editar"; id: string };
type DialogoPedido = { modo: "nuevo"; fecha: string } | { modo: "editar"; id: string };

export function AgendaClient({
  vista,
  fecha,
  hoy,
  turnos,
  pedidos,
  pedidosAbiertos,
  proximos,
  celulares,
  otros,
  ticketsListos,
  clientesOpciones,
  atendientes,
  user,
  negocio,
  cajas,
  tiendas,
}: {
  vista: VistaAgenda;
  fecha: string;
  hoy: string;
  /** Turnos del rango visible. */
  turnos: Turno[];
  /** Pedidos con entrega en el rango visible (fila «Todo el día»). */
  pedidos: Pedido[];
  /** Pedidos sin entregar de cualquier fecha (solo para los KPIs). */
  pedidosAbiertos: Pedido[];
  /** Vencidos + próximos 14 días (panel «Próximos» y KPIs). */
  proximos: Turno[];
  celulares: Celular[];
  otros: OtroItem[];
  ticketsListos: Ticket[];
  clientesOpciones: ClienteOpcion[];
  atendientes: { id: string; nombre: string }[];
  user: SessionUser;
  negocio: Negocio;
  cajas: Caja[];
  /** Tiendas extra de la organización (la principal es `negocio.nombre`). */
  tiendas: Tienda[];
}) {
  const { publish } = useRealtime();
  const actor = user.nombre;
  const esAdmin = tieneRol(user, "admin");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendiente, startTransition] = useTransition();
  const [selId, setSelId] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [eliminando, setEliminando] = useState<Turno | null>(null);
  const [pedidoSelId, setPedidoSelId] = useState<string | null>(null);
  const [dialogoPedido, setDialogoPedido] = useState<DialogoPedido | null>(null);
  const [errorPedido, setErrorPedido] = useState<string | null>(null);
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  const [eliminandoPedido, setEliminandoPedido] = useState<Pedido | null>(null);
  // Desde «Próximos» se abre un pedido que puede estar fuera del rango visible.
  const pedidoSel = pedidoSelId
    ? (pedidos.find((p) => p.id === pedidoSelId) ?? pedidosAbiertos.find((p) => p.id === pedidoSelId) ?? null)
    : null;
  const pedidoEditando =
    dialogoPedido?.modo === "editar"
      ? (pedidos.find((p) => p.id === dialogoPedido.id) ??
        pedidosAbiertos.find((p) => p.id === dialogoPedido.id) ??
        null)
      : null;

  // Todo lo conocido, sin duplicados (un turno puede estar en el rango y en próximos).
  const todos = useMemo(
    () => [...new Map([...proximos, ...turnos].map((t) => [t.id, t])).values()],
    [proximos, turnos],
  );
  const sel = selId ? (todos.find((t) => t.id === selId) ?? null) : null;
  const editando = dialogo?.modo === "editar" ? (todos.find((t) => t.id === dialogo.id) ?? null) : null;
  const kpis = kpisAgenda(todos, [...pedidosAbiertos, ...pedidos], hoy);

  // Destino de la navegación en curso: los tabs y la etiqueta cambian al
  // toque mientras el server trae el rango nuevo (si no, parece colgado).
  const [destino, setDestino] = useState<{ vista: VistaAgenda; fecha: string } | null>(null);
  const navegar = (v: VistaAgenda, f: string) => {
    setDestino({ vista: v, fecha: f });
    startTransition(() => router.replace(`/agenda?vista=${v}&fecha=${f}`, { scroll: false }));
  };
  const vistaVisible = pendiente && destino ? destino.vista : vista;
  const fechaVisible = pendiente && destino ? destino.fecha : fecha;

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

  async function guardarPedido(data: PedidoInput) {
    const edit = dialogoPedido?.modo === "editar" ? dialogoPedido.id : null;
    setGuardandoPedido(true);
    setErrorPedido(null);
    try {
      if (edit) await updatePedidoAction(edit, data);
      else await createPedidoAction(data);
      setDialogoPedido(null);
      startTransition(() => router.refresh());
    } catch (e) {
      setErrorPedido(e instanceof Error ? e.message : "No se pudo guardar el pedido.");
    } finally {
      setGuardandoPedido(false);
    }
  }

  function cambiarEstadoPedido(p: Pedido, estado: PedidoEstado) {
    startTransition(async () => {
      await setPedidoEstadoAction(p.id, estado);
    });
  }

  function eliminarPedido(p: Pedido) {
    setEliminandoPedido(null);
    setPedidoSelId(null);
    startTransition(async () => {
      await deletePedidoAction(p.id);
    });
  }

  const nuevoPedido = (f: string) => {
    setErrorPedido(null);
    setDialogoPedido({ modo: "nuevo", fecha: f });
  };

  const abrirSemana = (f: string) => navegar("semana", f);
  const agendar = (f: string, h: string) => setDialogo({ modo: "nuevo", fecha: f, hora: h });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Turnos hoy"
          value={kpis.hoy.turnos + kpis.hoy.pedidos}
          hint={desglose(kpis.hoy)}
        />
        <StatCard label="Pedidos pendientes" value={kpis.pedidosPendientes} hint="sin entregar ni cancelar" />
        <StatCard
          label="Vencidos"
          value={kpis.vencidos.turnos + kpis.vencidos.pedidos}
          hint={desglose(kpis.vencidos)}
          valueClassName={kpis.vencidos.turnos + kpis.vencidos.pedidos > 0 ? "text-red-500" : undefined}
        />
        <StatCard label="Atendidos última semana" value={kpis.atendidosSemana} hint="últimos 7 días" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-neutral-900/10 bg-white px-1 shadow-sm">
          <IconButton
            aria-label={vistaVisible === "mes" ? "Mes anterior" : "Semana anterior"}
            icon={ChevronLeft}
            variant="ghost"
            size="sm"
            onClick={() => navegar(vistaVisible, moverFecha(vistaVisible, fechaVisible, -1))}
          />
          <span className="min-w-[11rem] text-center text-sm font-medium">
            {etiquetaRango(vistaVisible, fechaVisible)}
          </span>
          <IconButton
            aria-label={vistaVisible === "mes" ? "Mes siguiente" : "Semana siguiente"}
            icon={ChevronRight}
            variant="ghost"
            size="sm"
            onClick={() => navegar(vistaVisible, moverFecha(vistaVisible, fechaVisible, 1))}
          />
        </div>
        <Tabs
          value={vistaVisible}
          onChange={(v) => navegar(v, fechaVisible)}
          options={[
            { value: "semana", label: "Semana" },
            { value: "mes", label: "Mes" },
          ]}
        />
        <Button
          icon={Package}
          variant="tonal"
          className="ml-auto"
          onClick={() => nuevoPedido(hoy)}
        >
          Nuevo pedido
        </Button>
        <Button
          icon={Plus}
          variant="primary"
          onClick={() => setDialogo({ modo: "nuevo", fecha: hoy, hora: "09:00" })}
        >
          Agendar turno
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
        {TIPOS.map((tp) => {
          const Icono = TURNO_ICONO[tp];
          return (
            <span key={tp} className="inline-flex items-center gap-1.5">
              <Icono aria-hidden className={cn("h-3.5 w-3.5", turnoBlockClass[tp].icono)} />
              {turnoTipo[tp].label}
            </span>
          );
        })}
        <span className="text-neutral-500">
          · <Package aria-hidden className="inline h-3 w-3" /> Pedido (todo el día)
          · Apagado: atendido / no vino · Tachado: cancelado
        </span>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative min-w-0" aria-busy={pendiente}>
          {pendiente && (
            <div
              role="status"
              className="absolute inset-0 z-30 flex animate-fade-in items-start justify-center rounded-2xl bg-white/70 pt-24 backdrop-blur-[1px]"
            >
              <span className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm">
                <Loader2 aria-hidden className="h-4 w-4 animate-spin text-accent" />
                Cargando {vistaVisible === "mes" ? "el mes" : "la semana"}…
              </span>
            </div>
          )}
          {vista === "mes" ? (
            <CalendarioMes
              fecha={fecha}
              turnos={turnos}
              pedidos={pedidos}
              hoy={hoy}
              onAbrirTurno={setSelId}
              onAbrirDia={abrirSemana}
              onAbrirPedido={setPedidoSelId}
            />
          ) : (
            <CalendarioGrilla
              dias={semanaDe(fecha)}
              turnos={turnos}
              hoy={hoy}
              pedidos={pedidos}
              onAgendar={agendar}
              onAbrirTurno={setSelId}
              onNuevoPedido={nuevoPedido}
              onAbrirPedido={setPedidoSelId}
            />
          )}
        </div>
        <Proximos
          turnos={proximos}
          pedidos={pedidosAbiertos}
          hoy={hoy}
          onAbrirTurno={setSelId}
          onAbrirPedido={setPedidoSelId}
          textoDe={(t) => textoParaCliente(t, { celulares, ticketsListos, negocio })}
        />
      </div>

      <TurnoDetalle
        turno={sel}
        celulares={celulares}
        ticketsListos={ticketsListos}
        clientes={clientesOpciones}
        esAdmin={esAdmin}
        negocio={negocio}
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

      <PedidoDetalle
        pedido={pedidoSel}
        hoy={hoy}
        clientes={clientesOpciones}
        cajas={cajas}
        esAdmin={esAdmin}
        onClose={() => setPedidoSelId(null)}
        onEstado={cambiarEstadoPedido}
        onEditar={(p) => {
          setPedidoSelId(null);
          setErrorPedido(null);
          setDialogoPedido({ modo: "editar", id: p.id });
        }}
        onEliminar={setEliminandoPedido}
      />

      <ConfirmDialog
        open={!!eliminandoPedido}
        onClose={() => setEliminandoPedido(null)}
        onConfirm={() => eliminandoPedido && eliminarPedido(eliminandoPedido)}
        title="¿Eliminar pedido?"
        confirmLabel="Eliminar pedido"
      >
        {eliminandoPedido &&
          `Se eliminará el pedido de «${eliminandoPedido.cliente}» (${eliminandoPedido.descripcion}).${
            eliminandoPedido.sena
              ? eliminandoPedido.sena.conciliado
                ? " La seña ya está conciliada: su movimiento queda en la caja."
                : " También se borra el ingreso de la seña en la caja."
              : ""
          } Esta acción no se puede deshacer.`}
      </ConfirmDialog>

      <PedidoDialog
        key={
          dialogoPedido?.modo === "editar"
            ? `pedido-editar-${dialogoPedido.id}`
            : dialogoPedido?.modo === "nuevo"
              ? `pedido-nuevo-${dialogoPedido.fecha}`
              : "pedido-none"
        }
        open={!!dialogoPedido && (dialogoPedido.modo === "nuevo" || !!pedidoEditando)}
        pedido={pedidoEditando}
        fechaInicial={dialogoPedido?.modo === "nuevo" ? dialogoPedido.fecha : hoy}
        clientesOpciones={clientesOpciones}
        cajas={cajas}
        error={errorPedido}
        guardando={guardandoPedido}
        onClose={() => setDialogoPedido(null)}
        onSubmit={guardarPedido}
      />

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
        cajas={cajas}
        tiendas={tiendas}
        onClose={() => setDialogo(null)}
        onSubmit={guardar}
      />
    </div>
  );
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** «2 turnos · 1 pedido» para el hint de las tarjetas que suman los dos. */
const desglose = (k: { turnos: number; pedidos: number }) =>
  `${plural(k.turnos, "turno", "turnos")} · ${plural(k.pedidos, "pedido", "pedidos")}`;
