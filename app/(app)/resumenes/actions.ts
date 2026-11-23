"use server";

import { revalidatePath } from "next/cache";
import { requireRoleEscritura } from "@/lib/auth";
import { generarResumenPropio } from "@/lib/db/resumenes";
import { esPeriodo } from "@/lib/resumen-mensual";

/** «Generar resumen» (admin): arma y guarda el resumen de un mes de la propia
 *  organización. Un mes que ya tiene resumen se reescribe (ver `origen`). */
export async function generarResumenAction(
  periodo: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireRoleEscritura("admin");
  if (!esPeriodo(periodo)) return { ok: false, error: "Período inválido." };
  try {
    await generarResumenPropio(user.organizationId, periodo);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo generar." };
  }
  revalidatePath("/resumenes");
  revalidatePath(`/resumenes/${periodo}`);
  return { ok: true };
}
