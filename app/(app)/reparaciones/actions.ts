"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireRole } from "@/lib/auth";
import { resolveCliente } from "@/lib/db/clientes";
import {
  addTicketItem,
  createTicket,
  entregarTicket,
  removeTicketItem,
  saveServicio,
  setChecklistEgreso,
  setTicketEstado,
  updateTicketItemPrecio,
  deleteTicket,
} from "@/lib/db/reparaciones";
import type {
  Checklist,
  ClienteSeleccion,
  Pago,
  Servicio,
  TicketServicio,
  TicketStatus,
} from "@/lib/types";

export async function createTicketAction(data: {
  cliente: Exclude<ClienteSeleccion, { tipo: "libre" }>;
  marca?: string;
  equipo: string;
  imei?: string;
  falla: string;
  reparacionSolicitada?: string;
  claveCodigo?: string;
  descripcionEquipo?: string;
  checklistIngreso?: Checklist;
  tecnicoId: string | null;
}) {
  await requireUser();
  const cliente = await resolveCliente(data.cliente);
  const ticket = await createTicket({
    clienteId: cliente.id,
    marca: data.marca,
    equipo: data.equipo,
    imei: data.imei,
    falla: data.falla,
    reparacionSolicitada: data.reparacionSolicitada,
    claveCodigo: data.claveCodigo,
    descripcionEquipo: data.descripcionEquipo,
    checklistIngreso: data.checklistIngreso,
    tecnicoId: data.tecnicoId,
  });
  revalidatePath("/reparaciones");
  return ticket;
}

export async function setChecklistEgresoAction(id: number, checklist: Checklist) {
  await requireUser();
  const ticket = await setChecklistEgreso(id, checklist);
  revalidatePath("/reparaciones");
  return ticket;
}

export async function entregarTicketAction(
  id: number,
  data: { checklist: Checklist; pagos: Pago[]; dolarVenta: number },
) {
  await requireUser();
  const ticket = await entregarTicket(id, data);
  revalidatePath("/reparaciones");
  revalidatePath("/cajas");
  revalidatePath("/cuentas-corrientes");
  return ticket;
}

export async function addTicketItemAction(ticketId: number, item: TicketServicio) {
  await requireUser();
  const ticket = await addTicketItem(ticketId, item);
  revalidatePath("/reparaciones");
  return ticket;
}

export async function removeTicketItemAction(ticketId: number, index: number) {
  await requireUser();
  const ticket = await removeTicketItem(ticketId, index);
  revalidatePath("/reparaciones");
  return ticket;
}

export async function updateTicketItemPrecioAction(
  ticketId: number,
  index: number,
  precioUsd: number,
) {
  await requireUser();
  const ticket = await updateTicketItemPrecio(ticketId, index, precioUsd);
  revalidatePath("/reparaciones");
  return ticket;
}

export async function setTicketEstadoAction(id: number, estado: TicketStatus) {
  await requireUser();
  const ticket = await setTicketEstado(id, estado);
  revalidatePath("/reparaciones");
  return ticket;
}

export async function deleteTicketAction(id: number) {
  await requireRole("admin");
  await deleteTicket(id);
  revalidatePath("/reparaciones");
  revalidatePath("/turnos");
}

export async function saveServicioAction(servicio: Servicio) {
  await requireUser();
  const saved = await saveServicio(servicio);
  revalidatePath("/reparaciones");
  return saved;
}
