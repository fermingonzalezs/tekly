"use server";

import { revalidatePath } from "next/cache";
import { requireRoleEscritura } from "@/lib/auth";
import {
  saveCaja,
  type CajaInput,
  createMovimiento,
  deleteMovimiento,
  crearConciliacion,
} from "@/lib/db/cajas";
import type { CategoriaGasto, ConciliacionLinea, MedioPago } from "@/lib/types";

export async function saveCajaAction(id: string | null, data: CajaInput) {
  await requireRoleEscritura("admin", "tecnico");
  const caja = await saveCaja(id, data);
  revalidatePath("/cajas");
  return caja;
}

export async function createMovimientoAction(data: {
  tipo: "ingreso" | "egreso";
  cajaId: string;
  concepto: string;
  medioPago: MedioPago;
  categoria?: CategoriaGasto | null;
  monto: number;
  cotizacion?: number | null;
}) {
  await requireRoleEscritura("admin", "tecnico");
  const mov = await createMovimiento(data);
  revalidatePath("/cajas");
  return mov;
}

export async function deleteMovimientoAction(id: string) {
  await requireRoleEscritura("admin");
  await deleteMovimiento(id);
  revalidatePath("/cajas");
}

export async function crearConciliacionAction(lineas: ConciliacionLinea[], comentario?: string) {
  await requireRoleEscritura("admin", "tecnico");
  const conciliacion = await crearConciliacion(lineas, comentario);
  revalidatePath("/cajas");
  return conciliacion;
}
