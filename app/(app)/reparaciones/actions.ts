"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireRole } from "@/lib/auth";
import { resolveCliente } from "@/lib/db/clientes";
import {
  createTicket,
  saveServicio,
  setTicketEstado,
  deleteTicket,
} from "@/lib/db/reparaciones";
import type { ClienteSeleccion, Servicio, TicketStatus } from "@/lib/types";

export async function createTicketAction(data: {
  cliente: Exclude<ClienteSeleccion, { tipo: "libre" }>;
  equipo: string;
  falla: string;
  tecnicoId: string | null;
}) {
  await requireUser();
  const cliente = await resolveCliente(data.cliente);
  const ticket = await createTicket({
    clienteId: cliente.id,
    equipo: data.equipo,
    falla: data.falla,
    tecnicoId: data.tecnicoId,
  });
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
