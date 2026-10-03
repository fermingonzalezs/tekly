"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import type { AuthResult, Rol } from "@/lib/auth/types";
import { setUserActivoPlatform, setUserRolePlatform } from "@/lib/db/admin";

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
