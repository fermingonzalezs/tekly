"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Link2, Check, X, Smartphone, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ClientePicker } from "@/components/ui/cliente-picker";
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
  Equipo,
  MedioPago,
  Pago,
} from "@/lib/types";
import type { SessionUser } from "@/lib/auth/types";
import type { Negocio } from "@/lib/db/configuracion";
import { montoConRecargo } from "@/lib/ventas";
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
  clientesOpciones,
  user,
  negocio,
}: {
  initialTurnos: Turno[];
  initialEquipos: Equipo[];
  clientesOpciones: ClienteOpcion[];
  user: SessionUser;
  negocio: Negocio;
}) {
  const { publish } = useRealtime();
  const actor = user.nombre;
  const esAdmin = user.rol === "admin";
  const [list, setList] = useState<Turno[]>(initialTurnos);
  const [equipos, setEquipos] = useState<Equipo[]>(initialEquipos);
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
    pagos: Pago[];
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
      if (data.equipoIds.length) {
        const nuevoEstado = data.tipo === "retira" ? "vendido" : "reservado";
        setEquipos((p) =>
          p.map((e) =>
            data.equipoIds.includes(e.id) ? { ...e, estado: nuevoEstado } : e,
          ),
        );
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
              <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
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

            {sel.equipoIds && sel.equipoIds.length > 0 && (
              <div>
                <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
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
                <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Pago
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {sel.pagos.map((p, i) => (
                    <Card key={i} className="flex flex-col p-3 text-center">
                      <p className="font-grotesk border-b border-neutral-300 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
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
                    <p className="font-grotesk border-b border-neutral-300 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
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

            {!sel.ticketId && (!sel.equipoIds || sel.equipoIds.length === 0) && (
              <p className="text-sm text-neutral-400">
                Sin ticket ni equipos vinculados.
              </p>
            )}

            {sel.nota && (
              <div>
                <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
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
        clientesOpciones={clientesOpciones}
        negocio={negocio}
        onClose={() => setSlot(null)}
        onSubmit={agendar}
      />
    </div>
  );
}

type DraftPago = { _k: string; medio: MedioPago; montoUsd: number; caja: "usd" | "ars" };

/** Turnos que involucran uno o varios equipos del inventario: la compra
 * (reserva + seña) y el retiro (pago del saldo, se entrega el equipo). */
const TIPOS_CON_EQUIPO: TurnoTipo[] = ["compra", "retira"];

function AgendarDialog({
  slot,
  dayLabel,
  equipos,
  clientesOpciones,
  negocio,
  onClose,
  onSubmit,
}: {
  slot: { dayOffset: number; hora: string } | null;
  dayLabel: string;
  equipos: Equipo[];
  clientesOpciones: ClienteOpcion[];
  negocio: Negocio;
  onClose: () => void;
  onSubmit: (d: {
    cliente: ClienteSeleccion;
    tipo: TurnoTipo;
    equipoIds: string[];
    pagos: Pago[];
    nota: string;
  }) => void;
}) {
  const [cliente, setCliente] = useState<ClienteSeleccion | null>(null);
  const [tipo, setTipo] = useState<TurnoTipo>("cotizar");
  const [equipoIds, setEquipoIds] = useState<string[]>([]);
  const [pagos, setPagos] = useState<DraftPago[]>([
    { _k: rid(), medio: "pesos", montoUsd: 0, caja: defaultCaja("pesos") },
  ]);
  const [nota, setNota] = useState("");

  const conEquipo = TIPOS_CON_EQUIPO.includes(tipo);
  const pool = equipos.filter((e) =>
    tipo === "retira" ? e.estado === "reservado" : e.estado === "disponible",
  );
  const seleccionados = equipos.filter((e) => equipoIds.includes(e.id));
  const totalEquipos = seleccionados.reduce((a, e) => a + e.precioUsd, 0);
  const totalPagado = pagos.reduce((a, p) => a + p.montoUsd, 0);

  useEffect(() => {
    setEquipoIds([]);
  }, [tipo]);

  function toggleEquipo(id: string) {
    setEquipoIds((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
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

  function submit() {
    if (!cliente) return;
    onSubmit({
      cliente,
      tipo,
      equipoIds: conEquipo ? equipoIds : [],
      pagos: conEquipo
        ? pagos
            .filter((p) => p.montoUsd > 0)
            .map(({ medio, montoUsd, caja }) => ({ medio, montoUsd, caja }))
        : [],
      nota: conEquipo ? nota : "",
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
            disabled={!cliente}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
          >
            Agendar
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
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

        {conEquipo && (
          <>
            <div>
              <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {tipo === "retira" ? "Equipo a retirar" : "Equipos a comprar"}
              </p>
              <EquipoPicker
                pool={pool}
                selectedIds={equipoIds}
                onToggle={toggleEquipo}
              />
              {pool.length === 0 && (
                <p className="mt-2 text-[13px] text-neutral-400">
                  {tipo === "retira"
                    ? "No hay equipos reservados por el momento."
                    : "No hay equipos disponibles en el inventario."}
                </p>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between border-b border-neutral-200 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Pago
                </p>
                <span className="text-xs font-semibold tabular-nums text-neutral-500">
                  Equipos {fmtUsd(totalEquipos)}
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

            <div>
              <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Observaciones
              </p>
              <Textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Notas para este turno (opcional)"
                rows={2}
              />
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

// ── Selector múltiple de equipos del inventario ─────────────────

function EquipoPicker({
  pool,
  selectedIds,
  onToggle,
}: {
  pool: Equipo[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const matches = pool.filter((e) =>
    `${e.modelo} ${e.almacenamiento} ${e.color}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <Input
        placeholder="Buscar equipo por modelo…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="max-h-40 overflow-y-auto rounded-lg border border-neutral-200">
        {matches.length === 0 && (
          <p className="px-3 py-2 text-[13px] text-neutral-400">
            Sin coincidencias.
          </p>
        )}
        {matches.map((e) => {
          const sel = selectedIds.includes(e.id);
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onToggle(e.id)}
              className={cn(
                "flex w-full items-center justify-between gap-3 border-b border-neutral-100 px-3 py-2 text-left text-[13px] last:border-b-0 hover:bg-neutral-50",
                sel && "bg-accent-soft",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "grid h-4 w-4 shrink-0 place-items-center rounded border",
                    sel ? "border-accent bg-accent" : "border-neutral-300",
                  )}
                >
                  {sel && <Check className="h-3 w-3 text-white" />}
                </span>
                <span className="truncate">
                  {e.modelo} {e.almacenamiento} · {e.color}
                </span>
              </span>
              <span className="shrink-0 font-semibold text-neutral-500">
                {fmtUsd(e.precioUsd)}
              </span>
            </button>
          );
        })}
      </div>
      {selectedIds.length > 0 && (
        <p className="text-[11px] text-neutral-400">
          {selectedIds.length} equipo{selectedIds.length === 1 ? "" : "s"}{" "}
          seleccionado{selectedIds.length === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  );
}
