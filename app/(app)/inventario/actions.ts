"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireEscritura, requireRoleEscritura } from "@/lib/auth";
import {
  updateCelular,
  deleteCelular,
  crearRecuentoCelulares,
  type CelularInput,
  updateRepuesto,
  type RepuestoInput,
  crearRecuentoRepuestos,
  deleteRepuesto,
  updateOtro,
  crearRecuentoOtros,
  deleteOtro,
  listMovimientos,
} from "@/lib/db/inventario";
import {
  updateNotebook,
  deleteNotebook,
  type NotebookInput,
} from "@/lib/db/notebooks";
import {
  createVariante,
  updateVariante,
  renombrarGrupo,
  setVarianteActiva,
  deleteVariante,
  unirVariantes,
  type VarianteInput,
} from "@/lib/db/variantes";
import type {
  Notebook,
  OtroItem,
  Variante,
  VarianteCategoria,
} from "@/lib/types";

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

// ─────────────────────────── Variantes ───────────────────────────

export type VarianteActionResult =
  | { ok: true; variante: Variante }
  | { ok: false; error: string };

function mensajeDeError(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/** Crear/editar variante y renombrar el grupo: cualquier rol con escritura
 * (un vendedor también carga celulares). Unir / desactivar / eliminar quedan
 * para admin, como el resto de los borrados. */
export async function createVarianteAction(data: VarianteInput): Promise<VarianteActionResult> {
  await requireEscritura();
  try {
    const variante = await createVariante(data);
    revalidatePath("/inventario");
    return { ok: true, variante };
  } catch (e) {
    return { ok: false, error: mensajeDeError(e, "No se pudo crear la variante.") };
  }
}

export async function updateVarianteAction(
  id: string,
  data: VarianteInput,
): Promise<VarianteActionResult> {
  await requireEscritura();
  try {
    const variante = await updateVariante(id, data);
    revalidatePath("/inventario");
    return { ok: true, variante };
  } catch (e) {
    return { ok: false, error: mensajeDeError(e, "No se pudo guardar la variante.") };
  }
}

export async function renombrarGrupoAction(
  grupoActual: string,
  nuevo: string,
  categoria: VarianteCategoria = "celular",
): Promise<{ ok: boolean; error?: string }> {
  await requireEscritura();
  try {
    await renombrarGrupo(grupoActual, nuevo, categoria);
    revalidatePath("/inventario");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeDeError(e, "No se pudo renombrar el grupo.") };
  }
}

export async function setVarianteActivaAction(
  id: string,
  activa: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await requireRoleEscritura("admin");
  try {
    await setVarianteActiva(id, activa);
    revalidatePath("/inventario");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeDeError(e, "No se pudo cambiar el estado de la variante.") };
  }
}

export async function deleteVarianteAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireRoleEscritura("admin");
  try {
    await deleteVariante(id);
    revalidatePath("/inventario");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeDeError(e, "No se pudo eliminar la variante.") };
  }
}

export async function unirVariantesAction(
  origenId: string,
  destinoId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireRoleEscritura("admin");
  try {
    await unirVariantes(origenId, destinoId);
    revalidatePath("/inventario");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeDeError(e, "No se pudieron unir las variantes.") };
  }
}
