"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createTicket,
  saveServicio,
  setTicketEstado,
} from "@/lib/db/reparaciones";
import type { Servicio, TicketStatus } from "@/lib/types";

export async function createTicketAction(data: {
  clienteId: string;
  equipo: string;
  falla: string;
  tecnicoId: string | null;
}) {
  await requireUser();
  const ticket = await createTicket(data);
  revalidatePath("/reparaciones");
  return ticket;
}

export async function setTicketEstadoAction(id: number, estado: TicketStatus) {
  await requireUser();
  const ticket = await setTicketEstado(id, estado);
  revalidatePath("/reparaciones");
  return ticket;
}

export async function saveServicioAction(servicio: Servicio) {
  await requireUser();
  const saved = await saveServicio(servicio);
  revalidatePath("/reparaciones");
  return saved;
}
