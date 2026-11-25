"use server";

import { redirect } from "next/navigation";
import { crearContrasenaInvitado } from "@/lib/auth";
import { bienvenidaSchema } from "@/lib/auth/validation";

export type BienvenidaState = { error: string | null };

export async function bienvenidaAction(
  _prev: BienvenidaState,
  formData: FormData,
): Promise<BienvenidaState> {
  const parsed = bienvenidaSchema.safeParse({
    nombre: formData.get("nombre"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { error } = await crearContrasenaInvitado(parsed.data.nombre, parsed.data.password);
  if (error) return { error };

  redirect("/dashboard");
}
