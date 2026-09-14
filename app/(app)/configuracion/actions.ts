"use server";

import { revalidatePath } from "next/cache";
import { requireUser, inviteMember, setMemberRole } from "@/lib/auth";
import type { AuthResult, Rol } from "@/lib/auth/types";
import {
  saveWhatsappTemplate,
  updateNegocio,
  type Negocio,
  type WhatsappTemplate,
} from "@/lib/db/configuracion";

export async function inviteMemberAction(
  email: string,
  nombre: string,
  rol: Rol,
): Promise<AuthResult> {
  const result = await inviteMember({ email, nombre, rol });
  if (!result.error) revalidatePath("/configuracion");
  return result;
}

export async function setMemberRoleAction(
  targetProfileId: string,
  nuevoRol: Rol,
): Promise<AuthResult> {
  const result = await setMemberRole(targetProfileId, nuevoRol);
  if (!result.error) revalidatePath("/configuracion");
  return result;
}

export async function saveWhatsappTemplateAction(
  id: string | null,
  data: { nombre: string; texto: string },
): Promise<WhatsappTemplate> {
  await requireUser();
  const row = await saveWhatsappTemplate(id, data);
  revalidatePath("/configuracion");
  return row;
}

export async function updateNegocioAction(data: Negocio): Promise<void> {
  await updateNegocio(data);
  revalidatePath("/configuracion");
}
