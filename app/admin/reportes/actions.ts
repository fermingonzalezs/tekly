"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { reabrirReporteBug, resolverReporteBug } from "@/lib/db/admin";

/** Resolver / reabrir un reporte de «Reportar un problema». Gate primero:
 * `lib/db/admin.ts` corre por service role. */
export async function resolverReporteAction(
  id: string,
  respuesta: string,
): Promise<{ error: string | null }> {
  await requirePlatformAdmin();
  try {
    await resolverReporteBug(id, respuesta);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar." };
  }
  revalidatePath("/admin/reportes");
  return { error: null };
}

export async function reabrirReporteAction(id: string): Promise<{ error: string | null }> {
  await requirePlatformAdmin();
  try {
    await reabrirReporteBug(id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo reabrir." };
  }
  revalidatePath("/admin/reportes");
  return { error: null };
}
