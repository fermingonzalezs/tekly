"use server";

import { revalidatePath } from "next/cache";
import { requireEscritura, requireRoleEscritura } from "@/lib/auth";
import { resolveCliente } from "@/lib/db/clientes";
import { createTurno, updateTurno, setTurnoEstado, deleteTurno } from "@/lib/db/turnos";
import type {
  ClienteSeleccion,
  Pago,
  TurnoEstado,
  TurnoOtroItem,
  TurnoTipo,
} from "@/lib/types";

export type TurnoInput = {
  fecha: string;
  hora: string;
  duracionMin: number;
  atiendeId: string | null;
  cliente: ClienteSeleccion;
  tipo: TurnoTipo;
  /** Solo "retira": ticket listo que se viene a retirar. */
  ticketId: number | null;
  /** Solo "compra". */
  celularIds: string[];
  itemsOtros: TurnoOtroItem[];
  pagos: Pago[];
  reservarStock: boolean;
  nota: string;
};

async function datosDe(data: TurnoInput) {
  const cliente =
    data.cliente.tipo === "libre"
      ? { id: null, nombre: data.cliente.nombre }
      : await resolveCliente(data.cliente);
  return {
    fecha: data.fecha,
    hora: data.hora,
    duracionMin: data.duracionMin,
    atiendeId: data.atiendeId,
    cliente: cliente.nombre,
    clienteId: cliente.id,
    tipo: data.tipo,
    ticketId: data.ticketId,
    celularIds: data.celularIds,
    itemsOtros: data.itemsOtros,
    pagos: data.pagos,
    reservarStock: data.reservarStock,
    nota: data.nota,
  };
}

function revalidar() {
  revalidatePath("/agenda");
  revalidatePath("/inventario");
  revalidatePath("/dashboard");
}

export async function createTurnoAction(data: TurnoInput) {
  await requireEscritura();
  const turno = await createTurno(await datosDe(data));
  revalidar();
  return turno;
}

export async function updateTurnoAction(id: string, data: TurnoInput) {
  await requireEscritura();
  const turno = await updateTurno(id, await datosDe(data));
  revalidar();
  return turno;
}

export async function setTurnoEstadoAction(id: string, estado: TurnoEstado) {
  await requireEscritura();
  const turno = await setTurnoEstado(id, estado);
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return turno;
}

export async function deleteTurnoAction(id: string) {
  await requireRoleEscritura("admin");
  await deleteTurno(id);
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
}
