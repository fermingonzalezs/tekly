"use server";

import { redirect } from "next/navigation";
import { signUp } from "@/lib/auth";
import { signupSchema } from "@/lib/auth/validation";

export type SignupState = { error: string | null; sent?: boolean };

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    organizacionNombre: formData.get("organizacionNombre"),
    nombre: formData.get("nombre"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // No viaja por zod: no es un campo de negocio, es el token del widget de
  // Turnstile (`signup-form.tsx`), string vacío cuando el captcha está
  // deshabilitado (sin NEXT_PUBLIC_TURNSTILE_SITE_KEY) o todavía sin resolver.
  const captchaToken = formData.get("cf-turnstile-response");

  const { error, needsEmailConfirmation } = await signUp({
    ...parsed.data,
    captchaToken: typeof captchaToken === "string" ? captchaToken : undefined,
  });
  if (error) return { error };

  if (needsEmailConfirmation) return { error: null, sent: true };

  redirect("/dashboard");
}
