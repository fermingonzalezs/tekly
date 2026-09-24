"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireRole } from "@/lib/auth";
import {
  createEquipo,
  updateEquipo,
  deleteEquipo,
  crearRecuentoEquipos,
  type EquipoInput,
  updateRepuesto,
  type RepuestoInput,
  crearRepuesto,
  ingresoRepuesto,
  crearRecuentoRepuestos,
  deleteRepuesto,
  updateOtro,
  crearOtro,
  ingresoOtroExistente,
  crearRecuentoOtros,
  deleteOtro,
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

export async function deleteEquipoAction(id: string) {
  await requireRole("admin");
  await deleteEquipo(id);
  revalidatePath("/inventario");
}

export async function crearRecuentoEquiposAction(
  draft: Record<string, boolean>,
  comentarios: Record<string, string>,
) {
  await requireUser();
  const recuento = await crearRecuentoEquipos(draft, comentarios);
  revalidatePath("/recuentos");
  return recuento;
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

export async function crearRecuentoRepuestosAction(draft: Record<string, number>) {
  await requireUser();
  const recuento = await crearRecuentoRepuestos(draft);
  revalidatePath("/recuentos");
  return recuento;
}

export async function deleteRepuestoAction(id: string) {
  await requireRole("admin");
  await deleteRepuesto(id);
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

export async function crearRecuentoOtrosAction(draft: Record<string, number>) {
  await requireUser();
  const recuento = await crearRecuentoOtros(draft);
  revalidatePath("/recuentos");
  return recuento;
}

export async function deleteOtroAction(id: string) {
  await requireRole("admin");
  await deleteOtro(id);
  revalidatePath("/inventario");
}

export async function getMovimientosAction(
  itemType: "equipo" | "repuesto" | "otro",
  itemId: string,
) {
  await requireUser();
  return listMovimientos(itemType, itemId);
}
