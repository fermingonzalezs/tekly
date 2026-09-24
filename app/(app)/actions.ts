"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { signOut, updateOwnProfile, type AuthResult } from "@/lib/auth";
import { crearReporteBug } from "@/lib/db/reportes";

export async function signOutAction() {
  await signOut();
  redirect("/login");
}

export async function updateOwnProfileAction(
  nombre: string,
  alias: string,
): Promise<AuthResult> {
  const result = await updateOwnProfile(nombre, alias);
  if (!result.error) revalidatePath("/", "layout");
  return result;
}

/** `ruta` sale del header `referer` de la propia request de la action (la
 * página desde la que se mandó el form) -- no de un campo que arme el
 * cliente a mano. */
export async function reportarBugAction(descripcion: string) {
  const referer = headers().get("referer");
  const ruta = referer ? new URL(referer).pathname : "desconocida";
  await crearReporteBug(descripcion, ruta);
}
