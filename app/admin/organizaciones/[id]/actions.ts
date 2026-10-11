"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import type { AuthResult, Rol } from "@/lib/auth/types";
import { deleteOrganizacionPlatform, setPlanPlatform, setUserActivoPlatform, setUserRolePlatform } from "@/lib/db/admin";
import { esPlanEstado, esPlanId } from "@/lib/planes";

/** Mutaciones del panel de plataforma (`/admin`): cada una corre
 * `requirePlatformAdmin()` PRIMERO -- `lib/db/admin.ts` corre por service
 * role (bypassa RLS) y confía en que quien la llama ya pasó el gate, así que
 * el gate tiene que estar acá. `revalidatePath("/admin", "layout")`
 * revalida la overview y todos los detalles de una vez (la action no sabe
 * de qué org es el usuario que le mandaron). */

export async function setUserRolePlatformAction(
  targetProfileId: string,
  nuevoRol: Rol,
): Promise<AuthResult> {
  await requirePlatformAdmin();
  try {
    await setUserRolePlatform(targetProfileId, nuevoRol);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No se pudo cambiar el rol.",
    };
  }
  revalidatePath("/admin", "layout");
  return { error: null };
}

export async function setUserActivoPlatformAction(
  targetProfileId: string,
  activo: boolean,
): Promise<AuthResult> {
  const session = await requirePlatformAdmin();
  if (!activo && targetProfileId === session.id) {
    return { error: "No podés desactivar tu propio usuario." };
  }
  try {
    await setUserActivoPlatform(targetProfileId, activo);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No se pudo actualizar el estado.",
    };
  }
  revalidatePath("/admin", "layout");
  return { error: null };
}

/** Fecha `yyyy-mm-dd` del <input type="date"> -> fin de ese día en hora de
 * Argentina (nunca `toISOString()` sobre una fecha local). */
function finDeDia(fecha: string | null): string | null | undefined {
  if (fecha === null || fecha === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return undefined;
  return `${fecha}T23:59:59-03:00`;
}

export async function setPlanOrganizacionAction(
  orgId: string,
  input: { plan: string; estado: string; trialTermina: string | null; periodoTermina: string | null },
): Promise<AuthResult> {
  await requirePlatformAdmin();
  if (!esPlanId(input.plan) || !esPlanEstado(input.estado)) {
    return { error: "Plan o estado inválido." };
  }
  const trialTerminaAt = finDeDia(input.trialTermina);
  const periodoTerminaAt = finDeDia(input.periodoTermina);
  if (trialTerminaAt === undefined || periodoTerminaAt === undefined) {
    return { error: "Fecha inválida." };
  }
  try {
    await setPlanPlatform(orgId, {
      plan: input.plan,
      estado: input.estado,
      trialTerminaAt,
      periodoTerminaAt,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar el plan." };
  }
  revalidatePath("/admin", "layout");
  return { error: null };
}

export async function deleteOrganizacionPlatformAction(orgId: string): Promise<AuthResult> {
  const session = await requirePlatformAdmin();
  if (orgId === session.organizationId) {
    return { error: "No podés eliminar tu propia organización." };
  }
  try {
    await deleteOrganizacionPlatform(orgId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo eliminar la organización." };
  }
  revalidatePath("/admin", "layout");
  return { error: null };
}
