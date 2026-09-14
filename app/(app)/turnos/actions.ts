"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { resolveCliente } from "@/lib/db/clientes";
import { createTurno, setTurnoEstado } from "@/lib/db/turnos";
import type { ClienteSeleccion, Pago, TurnoEstado, TurnoTipo } from "@/lib/types";

export async function createTurnoAction(data: {
  dayOffset: number;
  hora: string;
  cliente: ClienteSeleccion;
  tipo: TurnoTipo;
  equipoIds: string[];
  pagos: Pago[];
  nota: string;
}) {
  await requireUser();
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
    equipoIds: data.equipoIds,
    pagos: data.pagos,
    nota: data.nota,
  });
  revalidatePath("/turnos");
  return turno;
}

export async function setTurnoEstadoAction(id: string, estado: TurnoEstado) {
  await requireUser();
  const turno = await setTurnoEstado(id, estado);
  revalidatePath("/turnos");
  return turno;
}
