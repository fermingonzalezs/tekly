"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createEquipo,
  updateEquipo,
  type EquipoInput,
  updateRepuesto,
  type RepuestoInput,
  crearRepuesto,
  ingresoRepuesto,
  recuentoRepuestos,
  updateOtro,
  crearOtro,
  ingresoOtroExistente,
  recuentoOtros,
  listMovimientos,
} from "@/lib/db/inventario";
import type { OtroCategoria, OtroItem, OtroUnidad } from "@/lib/types";

export async function createEquipoAction(data: EquipoInput) {
  await requireUser();
  const equipo = await createEquipo(data);
  revalidatePath("/inventario");
  return equipo;
}

export async function updateEquipoAction(id: string, data: EquipoInput) {
  await requireUser();
  const equipo = await updateEquipo(id, data);
  revalidatePath("/inventario");
  return equipo;
}

export async function updateRepuestoAction(id: string, data: RepuestoInput) {
  await requireUser();
  const repuesto = await updateRepuesto(id, data);
  revalidatePath("/inventario");
  return repuesto;
}

export async function nuevoRepuestoAction(
  nombre: string,
  precioCompra: number,
  cantidad: number,
) {
  await requireUser();
  const repuesto = await crearRepuesto(nombre, precioCompra, cantidad);
  revalidatePath("/inventario");
  return repuesto;
}

export async function ingresoRepuestoAction(
  id: string,
  cantidad: number,
  precioCompra: number,
) {
  await requireUser();
  const repuesto = await ingresoRepuesto(id, cantidad, precioCompra);
  revalidatePath("/inventario");
  return repuesto;
}

export async function recuentoRepuestosAction(draft: Record<string, number>) {
  await requireUser();
  await recuentoRepuestos(draft);
  revalidatePath("/inventario");
}

export async function updateOtroAction(id: string, item: OtroItem) {
  await requireUser();
  const otro = await updateOtro(id, item);
  revalidatePath("/inventario");
  return otro;
}

export async function nuevoOtroAction(
  nombre: string,
  precioCompra: number,
  cantidad: number,
  categoria: OtroCategoria | undefined,
  unidades: OtroUnidad[] | undefined,
) {
  await requireUser();
  const otro = await crearOtro({
    nombre,
    precioCompra,
    cantidad,
    categoria: categoria ?? "otro",
    unidades,
  });
  revalidatePath("/inventario");
  return otro;
}

export async function ingresoOtroAction(
  id: string,
  cantidad: number,
  precioCompra: number,
  unidades: OtroUnidad[] | undefined,
) {
  await requireUser();
  const otro = await ingresoOtroExistente(id, cantidad, precioCompra, unidades);
  revalidatePath("/inventario");
  return otro;
}

export async function recuentoOtrosAction(draft: Record<string, number>) {
  await requireUser();
  await recuentoOtros(draft);
  revalidatePath("/inventario");
}

export async function getMovimientosAction(
  itemType: "equipo" | "repuesto" | "otro",
  itemId: string,
) {
  await requireUser();
  return listMovimientos(itemType, itemId);
}
