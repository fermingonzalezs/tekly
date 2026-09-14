"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  saveCaja,
  type CajaInput,
  createMovimiento,
  crearConciliacion,
} from "@/lib/db/cajas";
import type { ConciliacionLinea, MedioPago } from "@/lib/types";

export async function saveCajaAction(id: string | null, data: CajaInput) {
  await requireUser();
  const caja = await saveCaja(id, data);
  revalidatePath("/cajas");
  return caja;
}

export async function createMovimientoAction(data: {
  tipo: "ingreso" | "egreso";
  cajaId: string;
  concepto: string;
  medioPago: MedioPago;
  monto: number;
}) {
  await requireUser();
  const mov = await createMovimiento(data);
  revalidatePath("/cajas");
  return mov;
}

export async function crearConciliacionAction(lineas: ConciliacionLinea[]) {
  await requireUser();
  const conciliacion = await crearConciliacion(lineas);
  revalidatePath("/cajas");
  return conciliacion;
}
