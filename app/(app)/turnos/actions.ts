"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createTurno, setTurnoEstado } from "@/lib/db/turnos";
import type { Pago, TurnoEstado, TurnoTipo } from "@/lib/types";

export async function createTurnoAction(data: {
  dayOffset: number;
  hora: string;
  cliente: string;
  tipo: TurnoTipo;
  equipoIds: string[];
  pagos: Pago[];
  nota: string;
}) {
  await requireUser();
  const turno = await createTurno(data);
  revalidatePath("/turnos");
  return turno;
}

export async function setTurnoEstadoAction(id: string, estado: TurnoEstado) {
  await requireUser();
  const turno = await setTurnoEstado(id, estado);
  revalidatePath("/turnos");
  return turno;
}
