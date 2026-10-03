"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  requireUser,
  signOut,
  updateOwnProfile,
  type AuthResult,
} from "@/lib/auth";
import { crearReporteBug } from "@/lib/db/reportes";
import {
  buscarGlobal,
  type ResultadoBusqueda,
} from "@/lib/db/busqueda";

export async function signOutAction() {
  await signOut();
  redirect("/login");
}

/** Búsqueda en vivo de la CommandPalette (Cmd+K) -- trae datos reales
 * (clientes, ventas, tickets, equipos, movimientos de caja) de la
 * organización del usuario. No es una mutación (sin revalidatePath), pero sí
 * `requireUser()` primero, mismo criterio que toda action de este archivo. */
export async function buscarGlobalAction(
  query: string,
): Promise<ResultadoBusqueda[]> {
  await requireUser();
  return buscarGlobal(query);
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
