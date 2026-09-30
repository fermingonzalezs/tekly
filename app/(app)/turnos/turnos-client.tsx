"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link2, X, Smartphone, Plus, Minus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { ClientePicker } from "@/components/ui/cliente-picker";
import { useOutsideClick } from "@/components/ui/use-outside-click";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  turnoTipo,
  turnoStatus,
  equipoStatus,
  medioPago,
  MEDIOS_CAJA,
  dotClass,
} from "@/lib/status";
import { fmtUsd } from "@/lib/format";
import { useRealtime } from "@/components/notifications/realtime-provider";
import { cn } from "@/lib/utils";
import { thDivider } from "@/lib/ui-styles";
import type {
  ClienteOpcion,
  ClienteSeleccion,
  Turno,
  TurnoTipo,
  TurnoOtroItem,
  Equipo,
  OtroItem,
  Ticket,
  MedioPago,
  Pago,
} from "@/lib/types";
import type { SessionUser } from "@/lib/auth/types";
import type { Negocio } from "@/lib/db/configuracion";
import { montoConRecargo } from "@/lib/ventas";
import { defaultTurnoSlot } from "@/lib/command-palette";
import { createTurnoAction, setTurnoEstadoAction, deleteTurnoAction } from "./actions";

const MEDIOS = MEDIOS_CAJA;

/** Caja sugerida según el medio; el usuario la puede cambiar a mano. */
function defaultCaja(medio: MedioPago): "usd" | "ars" {
  return medio === "pesos" ? "ars" : "usd";
}

const rid = () => Math.random().toString(36).slice(2);

const HORAS = Array.from({ length: 23 }, (_, i) => {
  const min = 9 * 60 + i * 30;
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60,
  ).padStart(2, "0")}`;
}); // 09:00 … 20:00 cada 30 min
const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const TIPOS: TurnoTipo[] = ["compra", "deja", "retira", "cotizar"];

const ZEBRA_STRIPES =
  "repeating-linear-gradient(45deg, rgba(0,0,0,0.025) 0 4px, rgba(0,0,0,0) 4px 8px)";

type ChipState = "normal" | "highlight" | "hidden";

export function TurnosClient({
  initialTurnos,
  initialEquipos,
  initialOtros,
  ticketsListos,
  clientesOpciones,
  user,
  negocio,
}: {
  initialTurnos: Turno[];
  initialEquipos: Equipo[];
  initialOtros: OtroItem[];
  /** Tickets en estado "listo" -- para agendar retiros y para el detalle
   * de un turno "retira" (un ticket ya entregado sale de esta lista y el
   * turno queda solo con el número, sin el detalle). */
  ticketsListos: Ticket[];
  clientesOpciones: ClienteOpcion[];
  user: SessionUser;
  negocio: Negocio;
}) {
  const { publish } = useRealtime();
  const actor = user.nombre;
  const esAdmin = user.rol === "admin";
  const [list, setList] = useState<Turno[]>(initialTurnos);
  const [equipos, setEquipos] = useState<Equipo[]>(initialEquipos);
  const [otros, setOtros] = useState<OtroItem[]>(initialOtros);
  const [sel, setSel] = useState<Turno | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [slot, setSlot] = useState<{ dayOffset: number; hora: string } | null>(
    null,
  );
  const [selectedDay, setSelectedDay] = useState(0);
  const [tipoState, setTipoState] = useState<Record<TurnoTipo, ChipState>>(
    () =>
      Object.fromEntries(TIPOS.map((t) => [t, "normal"])) as Record<
        TurnoTipo,
        ChipState
      >,
  );
  const [, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const router = useRouter();

  // ?accion=agendar-turno: el buscador global (CommandPalette) navega acá con
  // ese param. Efecto (no useState inicial) para que también funcione estando
  // ya parado en /turnos -- el componente no se remonta en la misma ruta.
  useEffect(() => {
    if (searchParams.get("accion") !== "agendar-turno") return;
    setSlot(defaultTurnoSlot());
    router.replace("/turnos"); // limpia el param -- evita reabrir con back/refresh
  }, [searchParams, router]);

  function cycleTipo(tp: TurnoTipo) {
    setTipoState((prev) => {
      const cur = prev[tp];
      const next: ChipState =
        cur === "normal" ? "highlight" : cur === "highlight" ? "hidden" : "normal";
      return { ...prev, [tp]: next };
    });
  }

  const anyHighlighted = TIPOS.some((tp) => tipoState[tp] === "highlight");

  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  // Puede haber más de un turno en el mismo día/horario -- devuelve todos
  // los que aplican, ya filtrados por los tipos ocultos de la referencia.
  const at = (dayOffset: number, hora: string) =>
    list.filter(
      (t) =>
        t.dayOffset === dayOffset &&
        t.hora === hora &&
        tipoState[t.tipo] !== "hidden",
    );

  function cancelar(t: Turno) {
    setList((p) =>
      p.map((x) => (x.id === t.id ? { ...x, estado: "cancelado" } : x)),
    );
    setSel(null);
    startTransition(async () => {
      await setTurnoEstadoAction(t.id, "cancelado");
    });
  }

  function eliminar(t: Turno) {
    setList((p) => p.filter((x) => x.id !== t.id));
    setSel(null);
    setConfirmDelete(false);
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

  function agendar(data: {
    cliente: ClienteSeleccion;
    tipo: TurnoTipo;
    equipoIds: string[];
    ticketId: number | null;
    itemsOtros: TurnoOtroItem[];
    pagos: Pago[];
    reservarStock: boolean;
    nota: string;
  }) {
    if (!slot) return;
    const { dayOffset, hora } = slot;
    startTransition(async () => {
      const turno = await createTurnoAction({ dayOffset, hora, ...data });
      setList((p) => [...p, turno]);
      publish({
        type: "appointment_scheduled",
        actor,
        client: turno.cliente,
        tipoLabel: turnoTipo[data.tipo].label,
        when: `${dayLabel(dayOffset)} · ${hora}`,
      });
      // Reserva optimista local, solo si se pidió -- mismo criterio que el
      // server (`createTurno`).
      if (data.reservarStock) {
        if (data.equipoIds.length) {
          setEquipos((p) =>
            p.map((e) =>
              data.equipoIds.includes(e.id) ? { ...e, estado: "reservado" } : e,
            ),
          );
        }
        if (data.itemsOtros.length) {
          setOtros((p) =>
            p.map((o) => {
              const item = data.itemsOtros.find((i) => i.otroId === o.id);
              if (!item) return o;
              if (!o.serializado) {
                return { ...o, cantidad: Math.max(0, o.cantidad - (item.cantidad ?? 0)) };
              }
              return {
                ...o,
                unidades: o.unidades.map((u) =>
                  u.serial === item.serial
                    ? { ...u, estado: "reservado" as const }
                    : u,
                ),
              };
            }),
          );
        }
      }
    });
    setSlot(null);
  }

  const dayLabel = (o: number) =>
    `${DOW[days[o].getDay()]} ${days[o].getDate()} ${MES[days[o].getMonth()]}`;

  return (
    <div className="space-y-4">
      {/* Referencia de colores: click resalta, click de nuevo oculta, click de nuevo vuelve a normal.
          Oculta en mobile -- ahí la página arranca directo con las tarjetas del día. */}
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        {TIPOS.map((tp) => {
          const state = tipoState[tp];
          return (
            <button
              key={tp}
              onClick={() => cycleTipo(tp)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                state === "hidden" &&
                  "bg-neutral-50 text-neutral-300 line-through",
                state === "highlight" &&
                  "bg-accent-soft text-accent ring-1 ring-inset ring-accent/30",
                state === "normal" &&
                  "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  state === "hidden"
                    ? "bg-neutral-300"
                    : dotClass[turnoTipo[tp].tone],
                )}
              />
              {turnoTipo[tp].label}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-neutral-400">
          Próximos 7 días · 09 a 20 h · tocá un hueco para agendar
        </span>
      </div>

      {/* Mobile: agenda de un día -- la grilla semanal completa obliga a
          scrollear de costado una tabla de 760px, injugable en un teléfono. */}
      <div className="md:hidden">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {days.map((d, i) => {
            const active = selectedDay === i;
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(i)}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-0.5 rounded-xl border px-3.5 py-1.5 transition-colors",
                  active
                    ? "border-accent bg-accent text-white"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-300",
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide">
                  {i === 0 ? "Hoy" : DOW[d.getDay()]}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {d.getDate()} {MES[d.getMonth()]}
                </span>
              </button>
            );
          })}
        </div>

        <Card className="mt-3 divide-y divide-neutral-100 overflow-hidden">
          {HORAS.map((h) => {
            const turnos = at(selectedDay, h);
            return (
              <div key={h} className="flex items-start gap-3 px-3 py-2">
                <span className="w-12 shrink-0 pt-1 text-[11px] font-medium tabular-nums text-neutral-400">
                  {h}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  {turnos.map((t) => {
                    const dimmed = anyHighlighted && tipoState[t.tipo] !== "highlight";
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSel(t)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md bg-neutral-100 px-2.5 py-1.5 text-left transition-colors hover:bg-neutral-200",
                          dimmed && "opacity-30",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            dotClass[turnoTipo[t.tipo].tone],
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate text-sm font-semibold text-neutral-900",
                              t.estado === "cancelado" && "line-through opacity-50",
                            )}
                          >
                            {t.cliente}
                          </span>
                          <span className="block truncate text-xs text-neutral-500">
                            {turnoTipo[t.tipo].label}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setSlot({ dayOffset: selectedDay, hora: h })}
                    className="flex h-6 w-full items-center justify-center rounded-md border border-dashed border-neutral-200 text-neutral-300 transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <Card className="hidden overflow-x-auto p-0 md:block">
        <div className="min-w-[760px]">
          {/* Encabezado de días */}
          <div
            className="grid bg-table-header"
            style={{ gridTemplateColumns: "3.25rem repeat(7, 1fr)" }}
          >
            <div className="flex items-center justify-center text-[10px] font-bold uppercase tracking-wide text-white/50">
              Hora
            </div>
            {days.map((d, i) => (
              <div
                key={i}
                className={cn(
                  "px-2 py-2 text-center",
                  i < 6 && thDivider,
                  i === 0 && "bg-white/10",
                )}
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-white/60">
                  {DOW[d.getDay()]}
                </p>
                <p className="text-sm font-semibold text-white">
                  {d.getDate()} {MES[d.getMonth()]}
                </p>
              </div>
            ))}
          </div>

          {/* Filas de horas */}
          {HORAS.map((h, hi) => (
            <div
              key={h}
              className="grid border-b border-neutral-100 last:border-b-0"
              style={{
                gridTemplateColumns: "3.25rem repeat(7, 1fr)",
                backgroundImage: hi % 2 === 1 ? ZEBRA_STRIPES : undefined,
              }}
            >
              <div className="py-2 pr-2 text-right text-[11px] font-medium tabular-nums text-neutral-400">
                {h}
              </div>
              {days.map((_, dayOffset) => {
                const turnos = at(dayOffset, h);
                return (
                  <div
                    key={dayOffset}
                    className="min-h-[46px] border-l border-neutral-100 p-1"
                  >
                    <div className="flex flex-col gap-1">
                      {turnos.map((t) => {
                        const dimmed =
                          anyHighlighted && tipoState[t.tipo] !== "highlight";
                        return (
                          <button
                            key={t.id}
                            onClick={() => setSel(t)}
                            className={cn(
                              "flex w-full items-start gap-1.5 rounded-md bg-neutral-100 px-2 py-1.5 text-left transition-colors hover:bg-neutral-200",
                              t.estado === "cancelado" && "line-through opacity-50",
                              dimmed && "opacity-30",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                                dotClass[turnoTipo[t.tipo].tone],
                              )}
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-neutral-900">
                                {t.cliente}
                              </span>
                              <span className="block truncate text-[11px] text-neutral-500">
                                {turnoTipo[t.tipo].label}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setSlot({ dayOffset, hora: h })}
                        className="flex h-5 w-full items-center justify-center rounded-md border border-dashed border-neutral-200 text-neutral-300 transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      {/* Detalle de turno */}
      <Dialog
        open={!!sel}
        onClose={() => setSel(null)}
        size="lg"
        accent
        title={sel ? sel.cliente : ""}
        description={sel ? `${dayLabel(sel.dayOffset)} · ${sel.hora}` : ""}
        footer={
          sel && (
            <>
              {esAdmin && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-red-200 px-4 text-sm font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 sm:mr-auto sm:w-auto"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar turno
                </button>
              )}
              <button
                onClick={() => setSel(null)}
                className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto"
              >
                Cerrar
              </button>
              {sel.estado !== "cancelado" && (
                <button
                  onClick={() => cancelar(sel)}
                  className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft sm:w-auto"
                >
                  <X className="h-4 w-4" /> Cancelar turno
                </button>
              )}
            </>
          )
        }
      >
        {sel && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Información general
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      dotClass[turnoTipo[sel.tipo].tone],
                    )}
                  />
                  {turnoTipo[sel.tipo].label}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      dotClass[turnoStatus[sel.estado].tone],
                    )}
                  />
                  {turnoStatus[sel.estado].label}
                </span>
                {sel.ticketId && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-accent">
                    <Link2 className="h-3.5 w-3.5" /> Ticket #{sel.ticketId}
                  </span>
                )}
              </div>
            </div>

            {sel.tipo === "retira" && sel.ticketId && (
              <TicketResumen ticket={ticketsListos.find((t) => t.id === sel.ticketId) ?? null} />
            )}

            {sel.equipoIds && sel.equipoIds.length > 0 && (
              <div>
                <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Equipos vinculados
                </p>
                <Card className="divide-y divide-neutral-100 overflow-hidden md:hidden">
                  {sel.equipoIds.map((id) => {
                    const e = equipos.find((x) => x.id === id);
                    if (!e) return null;
                    return (
                      <div key={id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm text-neutral-900">
                          <Smartphone className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                          <span className="truncate">
                            {e.modelo} {e.almacenamiento} · {e.color}
                          </span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              dotClass[equipoStatus[e.estado].tone],
                            )}
                          />
                          {equipoStatus[e.estado].label}
                        </span>
                        <span className="shrink-0 text-sm font-medium tabular-nums">
                          {fmtUsd(e.precioUsd)}
                        </span>
                      </div>
                    );
                  })}
                </Card>
                <div className="hidden overflow-hidden rounded-xl border border-neutral-200 md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className={cn("px-4 py-2 text-start", thDivider)}>
                          Equipo
                        </th>
                        <th className={cn("px-4 py-2 text-start", thDivider)}>
                          Estado
                        </th>
                        <th className="px-4 py-2 text-end">Precio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sel.equipoIds.map((id) => {
                        const e = equipos.find((x) => x.id === id);
                        if (!e) return null;
                        return (
                          <tr key={id}>
                            <td className="px-4 py-2.5 text-start">
                              <span className="flex items-center gap-2">
                                <Smartphone className="h-3.5 w-3.5 text-neutral-400" />
                                {e.modelo} {e.almacenamiento} · {e.color}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-start">
                              <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    dotClass[equipoStatus[e.estado].tone],
                                  )}
                                />
                                {equipoStatus[e.estado].label}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-end font-medium tabular-nums">
                              {fmtUsd(e.precioUsd)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {sel.pagos && sel.pagos.length > 0 && (
              <div>
                <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Pago
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {sel.pagos.map((p, i) => (
                    <Card key={i} className="flex flex-col p-3 text-center">
                      <p className="font-grotesk border-b border-neutral-300 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                        Método {i + 1}
                      </p>
                      <div className="flex flex-1 flex-col items-center justify-center gap-1.5 pt-2">
                        <p className="truncate text-sm font-normal tabular-nums text-neutral-600">
                          {fmtUsd(p.montoUsd)}
                        </p>
                        <span className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700">
                          <span
                            className={cn(
                              "h-1 w-1 shrink-0 rounded-full",
                              dotClass[medioPago[p.medio].tone],
                            )}
                          />
                          {medioPago[p.medio].label}
                        </span>
                      </div>
                    </Card>
                  ))}
                  <Card className="flex flex-col p-3 text-center">
                    <p className="font-grotesk border-b border-neutral-300 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                      Total abonado
                    </p>
                    <div className="flex flex-1 items-center justify-center pt-2">
                      <p className="truncate text-sm font-normal tabular-nums text-neutral-600">
                        {fmtUsd(sel.pagos.reduce((a, p) => a + p.montoUsd, 0))}
                      </p>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {sel.itemsOtros && sel.itemsOtros.length > 0 && (
              <div>
                <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Otros ítems vinculados
                </p>
                {/* Render simple a partir del snapshot guardado (nombre,
                    serial, precio) -- a diferencia de los equipos, no hace
                    falta resolver el estado en vivo de la unidad. */}
                <Card className="divide-y divide-neutral-100 overflow-hidden md:hidden">
                  {sel.itemsOtros.map((i) => (
                    <div
                      key={`${i.otroId}-${i.serial ?? "x"}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {i.nombre}
                        {i.cantidad != null && i.cantidad > 1 && ` ×${i.cantidad}`}
                        {i.serial && <span className="text-neutral-400"> · {i.serial}</span>}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {fmtUsd(i.precioUsd * (i.cantidad ?? 1))}
                      </span>
                    </div>
                  ))}
                </Card>
                <div className="hidden overflow-hidden rounded-xl border border-neutral-200 md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className={cn("px-4 py-2 text-start", thDivider)}>Ítem</th>
                        <th className="px-4 py-2 text-end">Precio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sel.itemsOtros.map((i) => (
                        <tr key={`${i.otroId}-${i.serial ?? "x"}`}>
                          <td className="px-4 py-2.5 text-start">
                            {i.nombre}
                            {i.cantidad != null && i.cantidad > 1 && (
                              <span className="text-neutral-400"> ×{i.cantidad}</span>
                            )}
                            {i.serial && (
                              <span className="text-neutral-400"> · {i.serial}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-end font-medium tabular-nums">
                            {fmtUsd(i.precioUsd * (i.cantidad ?? 1))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!sel.ticketId &&
              (!sel.equipoIds || sel.equipoIds.length === 0) &&
              (!sel.itemsOtros || sel.itemsOtros.length === 0) && (
                <p className="text-sm text-neutral-400">
                  Sin ticket ni ítems vinculados.
                </p>
              )}

            {sel.nota && (
              <div>
                <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Observaciones
                </p>
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                  {sel.nota}
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => sel && eliminar(sel)}
        title="¿Eliminar turno?"
        confirmLabel="Eliminar turno"
      >
        {sel && `Se eliminará el turno de «${sel.cliente}» (${dayLabel(sel.dayOffset)} · ${sel.hora}). Esta acción no se puede deshacer.`}
      </ConfirmDialog>

      {/* Agendar turno */}
      <AgendarDialog
        key={slot ? `${slot.dayOffset}-${slot.hora}` : "none"}
        slot={slot}
        dayLabel={slot ? `${dayLabel(slot.dayOffset)} · ${slot.hora}` : ""}
        equipos={equipos}
        otros={otros}
        ticketsListos={ticketsListos}
        clientesOpciones={clientesOpciones}
        negocio={negocio}
        onClose={() => setSlot(null)}
        onSubmit={agendar}
      />
    </div>
  );
}

type DraftPago = { _k: string; medio: MedioPago; montoUsd: number; caja: "usd" | "ars" };

function AgendarDialog({
  slot,
  dayLabel,
  equipos,
  otros,
  ticketsListos,
  clientesOpciones,
  negocio,
  onClose,
  onSubmit,
}: {
  slot: { dayOffset: number; hora: string } | null;
  dayLabel: string;
  equipos: Equipo[];
  otros: OtroItem[];
  ticketsListos: Ticket[];
  clientesOpciones: ClienteOpcion[];
  negocio: Negocio;
  onClose: () => void;
  onSubmit: (d: {
    cliente: ClienteSeleccion;
    tipo: TurnoTipo;
    equipoIds: string[];
    ticketId: number | null;
    itemsOtros: TurnoOtroItem[];
    pagos: Pago[];
    reservarStock: boolean;
    nota: string;
  }) => void;
}) {
  const [cliente, setCliente] = useState<ClienteSeleccion | null>(null);
  const [tipo, setTipo] = useState<TurnoTipo>("cotizar");
  const [nota, setNota] = useState("");

  // "retira": ticket listo a retirar + cómo se espera cobrar el presupuesto.
  // Arranca en el primero de la lista -- el <Select> no tiene opción vacía
  // (ver RetiraFields), así que con `null` el navegador ya muestra el primer
  // ticket tildado pero el estado de React se queda sin sincronizar: el
  // botón "Agendar" queda deshabilitado sin ninguna pista de por qué.
  const [ticketId, setTicketId] = useState<number | null>(ticketsListos[0]?.id ?? null);
  const [medioEsperado, setMedioEsperado] = useState<MedioPago>("pesos");
  const ticket = ticketsListos.find((t) => t.id === ticketId) ?? null;

  // "compra": carrito de equipos disponibles + ítems de "Otros", seña
  // opcional y reserva de stock opcional (antes la reserva era obligatoria).
  const [equipoIds, setEquipoIds] = useState<string[]>([]);
  const [carritoOtros, setCarritoOtros] = useState<TurnoOtroItem[]>([]);
  const [pagos, setPagos] = useState<DraftPago[]>([
    { _k: rid(), medio: "pesos", montoUsd: 0, caja: defaultCaja("pesos") },
  ]);
  const [reservarStock, setReservarStock] = useState(true);

  const seleccionados = equipos.filter((e) => equipoIds.includes(e.id));
  const totalCarrito =
    seleccionados.reduce((a, e) => a + e.precioUsd, 0) +
    carritoOtros.reduce((a, i) => a + i.precioUsd * (i.cantidad ?? 1), 0);
  const totalPagado = pagos.reduce((a, p) => a + p.montoUsd, 0);
  const hayItems = equipoIds.length > 0 || carritoOtros.length > 0;

  function toggleEquipo(id: string) {
    setEquipoIds((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );
  }

  function removeOtro(otroId: string, serial?: string) {
    setCarritoOtros((p) =>
      p.filter((i) => !(i.otroId === otroId && i.serial === serial)),
    );
  }

  /** Stepper de cantidad de un "Otro" no serializado -- tope: lo que hay en
   * stock (no se deja pedir más de lo disponible). */
  function cambiarCantidad(otroId: string, delta: number) {
    setCarritoOtros((p) =>
      p.map((i) => {
        if (i.otroId !== otroId || i.serial) return i;
        const o = otros.find((x) => x.id === otroId);
        const max = !o || o.serializado ? 1 : o.cantidad;
        return {
          ...i,
          cantidad: Math.min(max, Math.max(1, (i.cantidad ?? 1) + delta)),
        };
      }),
    );
  }

  const updPago = (k: string, patch: Partial<DraftPago>) =>
    setPagos((p) => p.map((x) => (x._k === k ? { ...x, ...patch } : x)));
  const rmPago = (k: string) =>
    setPagos((p) => (p.length > 1 ? p.filter((x) => x._k !== k) : p));
  const addPago = () =>
    setPagos((p) => {
      const medio =
        MEDIOS.find((m) => !p.some((x) => x.medio === m)) ?? "transferencia";
      return [...p, { _k: rid(), medio, montoUsd: 0, caja: defaultCaja(medio) }];
    });

  // "retira" sin ticket no tiene sentido -- sin uno listo para retirar, no
  // se agenda el turno (el selector avisa por qué).
  const puedeAgendar = !!cliente && (tipo !== "retira" || !!ticketId);

  function submit() {
    if (!puedeAgendar) return;
    onSubmit({
      cliente,
      tipo,
      equipoIds: tipo === "compra" ? equipoIds : [],
      ticketId: tipo === "retira" ? ticketId : null,
      itemsOtros: tipo === "compra" ? carritoOtros : [],
      pagos:
        tipo === "compra"
          ? pagos
              .filter((p) => p.montoUsd > 0)
              .map(({ medio, montoUsd, caja }) => ({ medio, montoUsd, caja }))
          : tipo === "retira" && ticket
            ? [
                {
                  medio: medioEsperado,
                  montoUsd: ticket.presupuestoUsd,
                  caja: defaultCaja(medioEsperado),
                },
              ]
            : [],
      reservarStock: tipo === "compra" && reservarStock,
      nota,
    });
  }

  return (
    <Dialog
      open={!!slot}
      onClose={onClose}
      size="lg"
      accent
      title="Agendar turno"
      description={dayLabel}
      footer={
        <>
          <button
            onClick={onClose}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!puedeAgendar}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
          >
            Agendar
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Información general
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cliente">
              <ClientePicker
                clientes={clientesOpciones}
                value={cliente}
                onChange={setCliente}
                allowLibre
              />
            </Field>
            <Field label="Motivo">
              <Select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TurnoTipo)}
              >
                {TIPOS.map((tp) => (
                  <option key={tp} value={tp}>
                    {turnoTipo[tp].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        {(tipo === "cotizar" || tipo === "deja") && (
          <ComentarioField value={nota} onChange={setNota} />
        )}

        {tipo === "retira" && (
          <RetiraFields
            tickets={ticketsListos}
            ticketId={ticketId}
            onTicketChange={setTicketId}
            medioEsperado={medioEsperado}
            onMedioChange={setMedioEsperado}
            nota={nota}
            onNotaChange={setNota}
          />
        )}

        {tipo === "compra" && (
          <>
            <div>
              <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Ítems
              </p>
              <CarritoBuscador
                equipos={equipos}
                otros={otros}
                equipoIds={equipoIds}
                carritoOtros={carritoOtros}
                onAddEquipo={toggleEquipo}
                onAddOtro={(item) => setCarritoOtros((p) => [...p, item])}
              />
              {hayItems && (
                <div className="mt-2 space-y-1.5">
                  {seleccionados.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-[13px]"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <Smartphone className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                        <span className="truncate">
                          {e.modelo} {e.almacenamiento} · {e.color}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {fmtUsd(e.precioUsd)}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleEquipo(e.id)}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-neutral-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {carritoOtros.map((i) => {
                    const o = otros.find((x) => x.id === i.otroId);
                    const max = o && !o.serializado ? o.cantidad : 1;
                    return (
                      <div
                        key={`${i.otroId}-${i.serial ?? "x"}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-[13px]"
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="min-w-0 flex-1 truncate">
                            {i.nombre}
                            {i.serial && (
                              <span className="text-neutral-400"> · {i.serial}</span>
                            )}
                          </span>
                          {!i.serial && (
                            <span className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => cambiarCantidad(i.otroId, -1)}
                                aria-label={`Restar una unidad de ${i.nombre}`}
                                className="grid h-5 w-5 place-items-center rounded border border-neutral-200 text-neutral-500 hover:border-neutral-300"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-4 text-center tabular-nums">
                                {i.cantidad ?? 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => cambiarCantidad(i.otroId, 1)}
                                disabled={(i.cantidad ?? 1) >= max}
                                aria-label={`Sumar una unidad de ${i.nombre}`}
                                className="grid h-5 w-5 place-items-center rounded border border-neutral-200 text-neutral-500 hover:border-neutral-300 disabled:opacity-30"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {fmtUsd(i.precioUsd * (i.cantidad ?? 1))}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeOtro(i.otroId, i.serial)}
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-neutral-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between border-b border-neutral-200 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Pago
                </p>
                <span className="text-xs font-semibold tabular-nums text-neutral-500">
                  Total {fmtUsd(totalCarrito)}
                </span>
              </div>
              <div className="space-y-2">
                {pagos.map((p) => {
                  const recargoPct = negocio.recargosMediosPago[p.medio] ?? 0;
                  return (
                    <div key={p._k} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Select
                          value={p.medio}
                          onChange={(e) => {
                            const medio = e.target.value as MedioPago;
                            updPago(p._k, { medio, caja: defaultCaja(medio) });
                          }}
                          className="w-40"
                        >
                          {MEDIOS.map((m) => (
                            <option key={m} value={m}>
                              {medioPago[m].label}
                            </option>
                          ))}
                        </Select>
                        <Input
                          className="flex-1"
                          type="number"
                          min={0}
                          placeholder="U$"
                          value={p.montoUsd || ""}
                          onChange={(e) =>
                            updPago(p._k, { montoUsd: Number(e.target.value) || 0 })
                          }
                        />
                        <button
                          type="button"
                          onClick={() => rmPago(p._k)}
                          disabled={pagos.length === 1}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-red-500 disabled:opacity-30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {recargoPct > 0 && p.montoUsd > 0 && (
                        <p className="pl-1 text-[11px] text-amber-600">
                          + {recargoPct}% recargo → cobra{" "}
                          {fmtUsd(montoConRecargo(p.montoUsd, recargoPct))}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={addPago}
                  disabled={pagos.length >= MEDIOS.length}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar medio
                </button>
                <span className="text-xs font-semibold tabular-nums text-neutral-500">
                  Abona ahora {fmtUsd(totalPagado)}
                </span>
              </div>
            </div>

            {hayItems && (
              <label className="flex items-center gap-2 text-sm text-neutral-600">
                <input
                  type="checkbox"
                  checked={reservarStock}
                  onChange={(e) => setReservarStock(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent/40"
                />
                Reservar estos ítems en el stock
              </label>
            )}

            <ComentarioField value={nota} onChange={setNota} />
          </>
        )}
      </div>
    </Dialog>
  );
}

/** Observaciones -- lo comparten los 4 motivos (antes solo salía para los
 * turnos con equipo, `cotizar`/`deja` no tenían forma de dejar un
 * comentario). */
function ComentarioField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        Observaciones
      </p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Notas para este turno (opcional)"
        rows={2}
      />
    </div>
  );
}

/** Presupuesto aceptado + servicios de un ticket listo -- de solo lectura,
 * tanto en "Retira reparación" del dialog de agendar como en el detalle de
 * un turno ya agendado. */
function TicketResumen({ ticket }: { ticket: Ticket | null }) {
  if (!ticket) return null;
  return (
    <div>
      <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        Reparación a retirar
      </p>
      <Card className="p-3">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-neutral-500">Presupuesto aceptado</span>
          <span className="font-semibold tabular-nums">
            {fmtUsd(ticket.presupuestoUsd)}
          </span>
        </div>
        {ticket.servicios.length > 0 && (
          <div className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {ticket.servicios.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 px-3 py-1.5 text-[13px]"
              >
                <span className="min-w-0 flex-1 truncate">{s.nombre}</span>
                <span className="shrink-0 tabular-nums text-neutral-500">
                  {fmtUsd(s.precioUsd)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/** "Retira reparación": el turno se vincula a un ticket en estado "listo"
 * (ya no a un equipo -- antes marcaba un equipo "vendido" sin ninguna Venta
 * real detrás) y se anota cómo se espera cobrar el presupuesto. */
function RetiraFields({
  tickets,
  ticketId,
  onTicketChange,
  medioEsperado,
  onMedioChange,
  nota,
  onNotaChange,
}: {
  tickets: Ticket[];
  ticketId: number | null;
  onTicketChange: (id: number) => void;
  medioEsperado: MedioPago;
  onMedioChange: (m: MedioPago) => void;
  nota: string;
  onNotaChange: (v: string) => void;
}) {
  const ticket = tickets.find((t) => t.id === ticketId) ?? null;
  return (
    <>
      <div>
        <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Reparación a retirar
        </p>
        {tickets.length === 0 ? (
          <p className="text-[13px] text-neutral-400">
            No hay reparaciones listas para retirar por el momento.
          </p>
        ) : (
          <>
            <Select
              value={ticketId ?? ""}
              onChange={(e) => onTicketChange(Number(e.target.value))}
            >
              {tickets.map((t) => (
                <option key={t.id} value={t.id}>
                  Ticket #{t.id} · {t.cliente} · {t.equipo}
                </option>
              ))}
            </Select>
            <div className="mt-2">
              <TicketResumen ticket={ticket} />
            </div>
          </>
        )}
      </div>
      {tickets.length > 0 && (
        <div>
          <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Método de pago esperado
          </p>
          <Select
            value={medioEsperado}
            onChange={(e) => onMedioChange(e.target.value as MedioPago)}
          >
            {MEDIOS.map((m) => (
              <option key={m} value={m}>
                {medioPago[m].label}
              </option>
            ))}
          </Select>
        </div>
      )}
      <ComentarioField value={nota} onChange={onNotaChange} />
    </>
  );
}

// ── Buscador del carrito de "Compra equipo" ────────────────────

/** Combobox sobre el catálogo real: equipos disponibles + "Otros" (sin
 * servicios ni ítem libre, a diferencia del `ItemBuscador` de Ventas -- acá
 * todo tiene que salir de stock). Un "Otro" serializado aparece como una fila
 * por unidad disponible (mismo criterio que un equipo), uno no serializado
 * como una fila con cantidad. */
function CarritoBuscador({
  equipos,
  otros,
  equipoIds,
  carritoOtros,
  onAddEquipo,
  onAddOtro,
}: {
  equipos: Equipo[];
  otros: OtroItem[];
  equipoIds: string[];
  carritoOtros: TurnoOtroItem[];
  onAddEquipo: (id: string) => void;
  onAddOtro: (item: TurnoOtroItem) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick<HTMLDivElement>(() => setOpen(false));

  const catalogo = useMemo(
    () => [
      ...equipos
        .filter((e) => e.estado === "disponible")
        .map((e) => ({
          key: `e-${e.id}`,
          origen: "equipo" as const,
          id: e.id,
          nombre: `${e.modelo} ${e.almacenamiento} ${e.color}`,
          serial: e.imei,
          precioUsd: e.precioUsd,
        })),
      ...otros.flatMap((o) => {
        if (o.serializado) {
          return o.unidades
            .filter((u) => !u.estado || u.estado === "disponible")
            .map((u) => ({
              key: `o-${o.id}-${u.serial}`,
              origen: "otro" as const,
              id: o.id,
              nombre: o.nombre,
              serial: u.serial,
              precioUsd: o.precioUsd,
            }));
        }
        return o.cantidad > 0
          ? [
              {
                key: `o-${o.id}`,
                origen: "otro" as const,
                id: o.id,
                nombre: o.nombre,
                serial: undefined as string | undefined,
                precioUsd: o.precioUsd,
              },
            ]
          : [];
      }),
    ],
    [equipos, otros],
  );

  const matches = catalogo.filter((c) => {
    const needle = q.trim().toLowerCase();
    const coincide =
      !needle ||
      c.nombre.toLowerCase().includes(needle) ||
      (c.serial?.toLowerCase().includes(needle) ?? false);
    if (!coincide) return false;
    if (c.origen === "equipo") return !equipoIds.includes(c.id);
    // Los ya agregados al carrito no se ofrecen dos veces (por id si no es
    // serializado, por serial si lo es).
    return !carritoOtros.some((i) =>
      c.serial ? i.otroId === c.id && i.serial === c.serial : i.otroId === c.id,
    );
  });

  return (
    <div ref={ref} className="relative">
      <Input
        placeholder="Buscar equipo o producto (iPad, AirPods…)"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="animate-menu-in origin-top absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
          {matches.slice(0, 8).map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                if (c.origen === "equipo") {
                  onAddEquipo(c.id);
                } else {
                  onAddOtro({
                    otroId: c.id,
                    nombre: c.nombre,
                    precioUsd: c.precioUsd,
                    ...(c.serial ? { serial: c.serial } : { cantidad: 1 }),
                  });
                }
                setQ("");
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-neutral-50"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Badge tone={c.origen === "equipo" ? "violet" : "blue"}>
                  {c.origen === "equipo" ? "Equipo" : "Producto"}
                </Badge>
                <span className="truncate">{c.nombre}</span>
                {c.serial && c.serial !== "—" && (
                  <span className="shrink-0 text-[11px] text-neutral-400">{c.serial}</span>
                )}
              </span>
              <span className="shrink-0 font-semibold text-neutral-500">
                {fmtUsd(c.precioUsd)}
              </span>
            </button>
          ))}
          {matches.length === 0 && (
            <p className="px-3 py-2 text-[13px] text-neutral-400">
              Sin coincidencias en el catálogo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
