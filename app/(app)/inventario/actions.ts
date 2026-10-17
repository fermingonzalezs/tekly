"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireEscritura, requireRoleEscritura } from "@/lib/auth";
import {
  createCelular,
  updateCelular,
  deleteCelular,
  crearRecuentoCelulares,
  type CelularInput,
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
import {
  createNotebook,
  updateNotebook,
  deleteNotebook,
  type NotebookInput,
} from "@/lib/db/notebooks";
import type { Notebook, OtroCategoria, OtroItem, OtroUnidad } from "@/lib/types";

export async function createCelularAction(data: CelularInput) {
  await requireEscritura();
  const celular = await createCelular(data);
  revalidatePath("/inventario");
  return celular;
}

export async function updateCelularAction(id: string, data: CelularInput) {
  await requireEscritura();
  const celular = await updateCelular(id, data);
  revalidatePath("/inventario");
  return celular;
}

export async function deleteCelularAction(id: string) {
  await requireRoleEscritura("admin");
  await deleteCelular(id);
  revalidatePath("/inventario");
}

export async function crearRecuentoCelularesAction(
  draft: Record<string, boolean>,
  comentarios: Record<string, string>,
  comentarioGeneral?: string,
) {
  await requireEscritura();
  const recuento = await crearRecuentoCelulares(draft, comentarios, comentarioGeneral);
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
  itemType: "celular" | "notebook" | "repuesto" | "otro",
  itemId: string,
) {
  await requireUser();
  return listMovimientos(itemType, itemId);
}

export type NotebookActionResult =
  | { ok: true; notebook: Notebook }
  | { ok: false; error: string };

export async function createNotebookAction(
  data: NotebookInput,
): Promise<NotebookActionResult> {
  await requireEscritura();
  try {
    const notebook = await createNotebook(data);
    revalidatePath("/inventario");
    return { ok: true, notebook };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo crear la notebook.",
    };
  }
}

export async function updateNotebookAction(
  id: string,
  data: NotebookInput,
): Promise<NotebookActionResult> {
  await requireEscritura();
  try {
    const notebook = await updateNotebook(id, data);
    revalidatePath("/inventario");
    return { ok: true, notebook };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar la notebook.",
    };
  }
}

export async function deleteNotebookAction(id: string) {
  await requireRoleEscritura("admin");
  await deleteNotebook(id);
  revalidatePath("/inventario");
}
