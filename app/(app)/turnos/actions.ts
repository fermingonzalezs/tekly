"use server";

import { revalidatePath } from "next/cache";
import { requireEscritura, requireRoleEscritura } from "@/lib/auth";
import { resolveCliente } from "@/lib/db/clientes";
import { createTurno, setTurnoEstado, deleteTurno } from "@/lib/db/turnos";
import type {
  ClienteSeleccion,
  Pago,
  TurnoEstado,
  TurnoOtroItem,
  TurnoTipo,
} from "@/lib/types";

export async function createTurnoAction(data: {
  dayOffset: number;
  hora: string;
  cliente: ClienteSeleccion;
  tipo: TurnoTipo;
  /** Solo "retira": ticket listo que se viene a retirar. */
  ticketId: number | null;
  /** Solo "compra". */
  equipoIds: string[];
  itemsOtros: TurnoOtroItem[];
  pagos: Pago[];
  reservarStock: boolean;
  nota: string;
}) {
  await requireEscritura();
  const cliente =
    data.cliente.tipo === "libre"
      ? { id: null, nombre: data.cliente.nombre }
      : await resolveCliente(data.cliente);
  const turno = await createTurno({
    dayOffset: data.dayOffset,
    hora: data.hora,
    cliente: cliente.nombre,
    clienteId: cliente.id,
    tipo: data.tipo,
    ticketId: data.ticketId,
    equipoIds: data.equipoIds,
    itemsOtros: data.itemsOtros,
    pagos: data.pagos,
    reservarStock: data.reservarStock,
    nota: data.nota,
  });
  revalidatePath("/turnos");
  revalidatePath("/inventario");
  revalidatePath("/dashboard");
  return turno;
}

export async function setTurnoEstadoAction(id: string, estado: TurnoEstado) {
  await requireEscritura();
  const turno = await setTurnoEstado(id, estado);
  revalidatePath("/turnos");
  revalidatePath("/dashboard");
  return turno;
}

export async function deleteTurnoAction(id: string) {
  await requireRoleEscritura("admin");
  await deleteTurno(id);
  revalidatePath("/turnos");
  revalidatePath("/dashboard");
}
