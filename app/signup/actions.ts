"use server";

import { redirect } from "next/navigation";
import { signUp } from "@/lib/auth";
import { signupSchema } from "@/lib/auth/validation";

export type SignupState = { error: string | null };

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    organizacionNombre: formData.get("organizacionNombre"),
    nombre: formData.get("nombre"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { error } = await signUp(parsed.data);
  if (error) return { error };

  redirect("/dashboard");
}
