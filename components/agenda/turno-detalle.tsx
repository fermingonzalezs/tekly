"use client";

import { Check, Link2, Pencil, RotateCcw, Smartphone, Trash2, UserX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { thDivider } from "@/lib/ui-styles";
import { fmtUsd } from "@/lib/format";
import { etiquetaDia, horaFin } from "@/lib/agenda";
import { celularStatus, dotClass, medioPago, turnoStatus, turnoTipo } from "@/lib/status";
import { TicketResumen } from "./ticket-resumen";
import type { Celular, ClienteOpcion, Ticket, Turno, TurnoEstado } from "@/lib/types";

/** Detalle de solo lectura de un turno + acciones de estado, editar y eliminar. */
export function TurnoDetalle({
  turno,
  celulares,
  ticketsListos,
  clientes,
  esAdmin,
  onClose,
  onEstado,
  onEditar,
  onEliminar,
}: {
  turno: Turno | null;
  celulares: Celular[];
  ticketsListos: Ticket[];
  clientes: ClienteOpcion[];
  esAdmin: boolean;
  onClose: () => void;
  onEstado: (t: Turno, estado: TurnoEstado) => void;
  onEditar: (t: Turno) => void;
  onEliminar: (t: Turno) => void;
}) {
  const abierto = turno && (turno.estado === "pendiente" || turno.estado === "confirmado");
  const cliente = turno?.clienteId ? clientes.find((c) => c.id === turno.clienteId) : undefined;
  return (
    <Dialog
      open={!!turno}
      onClose={onClose}
      size="2xl"
      title={turno ? turno.cliente : ""}
      description={
        turno
          ? `${etiquetaDia(turno.fecha)} · ${turno.hora}–${horaFin(turno.hora, turno.duracionMin)}`
          : ""
      }
      footer={
        turno && (
          <>
            {esAdmin && (
              <Button icon={Trash2} onClick={() => onEliminar(turno)} variant="danger-outline" fullOnMobile className="sm:mr-auto">
                Eliminar
              </Button>
            )}
            <Button onClick={onClose} variant="outline" fullOnMobile>
              Cerrar
            </Button>
            <Button icon={Pencil} onClick={() => onEditar(turno)} variant="outline" fullOnMobile>
              Editar
            </Button>
            {abierto ? (
              <>
                <Button icon={X} onClick={() => onEstado(turno, "cancelado")} variant="tonal" fullOnMobile>
                  Cancelar turno
                </Button>
                <Button icon={UserX} onClick={() => onEstado(turno, "no_vino")} variant="tonal" fullOnMobile>
                  No vino
                </Button>
                {turno.estado === "pendiente" && (
                  <Button onClick={() => onEstado(turno, "confirmado")} variant="tonal" fullOnMobile>
                    Confirmar
                  </Button>
                )}
                <Button icon={Check} onClick={() => onEstado(turno, "atendido")} variant="primary" fullOnMobile>
                  Atendido
                </Button>
              </>
            ) : (
              <Button icon={RotateCcw} onClick={() => onEstado(turno, "confirmado")} variant="tonal" fullOnMobile>
                Volver a confirmado
              </Button>
            )}
          </>
        )
      }
    >
      {turno && (
        <>
        <div className="mb-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Cliente</p>
            <p className="text-neutral-900">{turno.cliente}</p>
            {cliente?.telefono && <p className="text-xs tabular-nums text-neutral-500">{cliente.telefono}</p>}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Atiende</p>
            <p className="text-neutral-900">{turno.atiende ?? "Sin asignar"}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Duración</p>
            <p className="tabular-nums text-neutral-900">{turno.duracionMin} min</p>
          </div>
        </div>
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
                      dotClass[turnoTipo[turno.tipo].tone],
                    )}
                  />
                  {turnoTipo[turno.tipo].label}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      dotClass[turnoStatus[turno.estado].tone],
                    )}
                  />
                  {turnoStatus[turno.estado].label}
                </span>
                {turno.ticketId && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-accent">
                    <Link2 className="h-3.5 w-3.5" /> Ticket #{turno.ticketId}
                  </span>
                )}
              </div>
            </div>

            {turno.tipo === "retira" && turno.ticketId && (
              <TicketResumen ticket={ticketsListos.find((t) => t.id === turno.ticketId) ?? null} />
            )}

            {turno.celularIds && turno.celularIds.length > 0 && (
              <div>
                <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Celulares vinculados
                </p>
                <Card className="divide-y divide-neutral-100 overflow-hidden md:hidden">
                  {turno.celularIds.map((id) => {
                    const e = celulares.find((x) => x.id === id);
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
                              dotClass[celularStatus[e.estado].tone],
                            )}
                          />
                          {celularStatus[e.estado].label}
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
                        <th className={cn("px-4 py-2 text-center", thDivider)}>
                          Celular
                        </th>
                        <th className={cn("px-4 py-2 text-center", thDivider)}>
                          Estado
                        </th>
                        <th className="px-4 py-2 text-center">Precio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {turno.celularIds.map((id) => {
                        const e = celulares.find((x) => x.id === id);
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
                                    dotClass[celularStatus[e.estado].tone],
                                  )}
                                />
                                {celularStatus[e.estado].label}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center font-medium tabular-nums">
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

            {turno.pagos && turno.pagos.length > 0 && (
              <div>
                <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Pago
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {turno.pagos.map((p, i) => (
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
                        {fmtUsd(turno.pagos.reduce((a, p) => a + p.montoUsd, 0))}
                      </p>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {turno.itemsOtros && turno.itemsOtros.length > 0 && (
              <div>
                <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Otros ítems vinculados
                </p>
                {/* Render simple a partir del snapshot guardado (nombre,
                    serial, precio) -- a diferencia de los celulares, no hace
                    falta resolver el estado en vivo de la unidad. */}
                <Card className="divide-y divide-neutral-100 overflow-hidden md:hidden">
                  {turno.itemsOtros.map((i) => (
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
                        <th className={cn("px-4 py-2 text-center", thDivider)}>Ítem</th>
                        <th className="px-4 py-2 text-center">Precio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {turno.itemsOtros.map((i) => (
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
                          <td className="px-4 py-2.5 text-center font-medium tabular-nums">
                            {fmtUsd(i.precioUsd * (i.cantidad ?? 1))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!turno.ticketId &&
              (!turno.celularIds || turno.celularIds.length === 0) &&
              (!turno.itemsOtros || turno.itemsOtros.length === 0) && (
                <p className="text-sm text-neutral-400">
                  Sin ticket ni ítems vinculados.
                </p>
              )}

            {turno.nota && (
              <div>
                <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Observaciones
                </p>
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                  {turno.nota}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Dialog>
  );
}
