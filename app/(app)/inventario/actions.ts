"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireEscritura, requireRoleEscritura } from "@/lib/auth";
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
  await requireEscritura();
  const equipo = await createEquipo(data);
  revalidatePath("/inventario");
  return equipo;
}

export async function updateEquipoAction(id: string, data: EquipoInput) {
  await requireEscritura();
  const equipo = await updateEquipo(id, data);
  revalidatePath("/inventario");
  return equipo;
}

export async function deleteEquipoAction(id: string) {
  await requireRoleEscritura("admin");
  await deleteEquipo(id);
  revalidatePath("/inventario");
}

export async function crearRecuentoEquiposAction(
  draft: Record<string, boolean>,
  comentarios: Record<string, string>,
  comentarioGeneral?: string,
) {
  await requireEscritura();
  const recuento = await crearRecuentoEquipos(draft, comentarios, comentarioGeneral);
  revalidatePath("/recuentos");
  return recuento;
}

export async function updateRepuestoAction(id: string, data: RepuestoInput) {
  await requireEscritura();
  const repuesto = await updateRepuesto(id, data);
  revalidatePath("/inventario");
  return repuesto;
}

export async function nuevoRepuestoAction(
  nombre: string,
  precioCompra: number,
  cantidad: number,
) {
  await requireEscritura();
  const repuesto = await crearRepuesto(nombre, precioCompra, cantidad);
  revalidatePath("/inventario");
  return repuesto;
}

export async function ingresoRepuestoAction(
  id: string,
  cantidad: number,
  precioCompra: number,
) {
  await requireEscritura();
  const repuesto = await ingresoRepuesto(id, cantidad, precioCompra);
  revalidatePath("/inventario");
  return repuesto;
}

export async function crearRecuentoRepuestosAction(
  draft: Record<string, number>,
  comentarios: Record<string, string>,
  comentarioGeneral?: string,
) {
  await requireEscritura();
  const recuento = await crearRecuentoRepuestos(draft, comentarios, comentarioGeneral);
  revalidatePath("/recuentos");
  return recuento;
}

export async function deleteRepuestoAction(id: string) {
  await requireRoleEscritura("admin");
  await deleteRepuesto(id);
  revalidatePath("/inventario");
}

export async function updateOtroAction(id: string, item: OtroItem) {
  await requireEscritura();
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
  await requireEscritura();
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
  await requireEscritura();
  const otro = await ingresoOtroExistente(id, cantidad, precioCompra, unidades);
  revalidatePath("/inventario");
  return otro;
}

export async function crearRecuentoOtrosAction(
  draft: Record<string, number>,
  comentarios: Record<string, string>,
  comentarioGeneral?: string,
) {
  await requireEscritura();
  const recuento = await crearRecuentoOtros(draft, comentarios, comentarioGeneral);
  revalidatePath("/recuentos");
  return recuento;
}

export async function deleteOtroAction(id: string) {
  await requireRoleEscritura("admin");
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
