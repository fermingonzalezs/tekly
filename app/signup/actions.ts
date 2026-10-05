"use server";

import { redirect } from "next/navigation";
import { signUp } from "@/lib/auth";
import { signupSchema } from "@/lib/auth/validation";
import { LEGAL_BORRADOR, TERMINOS_VERSION } from "@/lib/legal";

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
    // Mientras los textos son borrador el form no muestra el checkbox y no se
    // registra aceptación (plan 012, `LEGAL_BORRADOR`).
    acepta: LEGAL_BORRADOR ? "on" : formData.get("acepta"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // No viaja por zod: no es un campo de negocio, es el token del widget de
  // Turnstile (`signup-form.tsx`), string vacío cuando el captcha está
  // deshabilitado (sin NEXT_PUBLIC_TURNSTILE_SITE_KEY) o todavía sin resolver.
  const captchaToken = formData.get("cf-turnstile-response");

  const { acepta: _acepta, ...datos } = parsed.data;
  const { error, needsEmailConfirmation } = await signUp({
    ...datos,
    terminosVersion: LEGAL_BORRADOR ? null : TERMINOS_VERSION,
    captchaToken: typeof captchaToken === "string" ? captchaToken : undefined,
  });
  if (error) return { error };

  if (needsEmailConfirmation) return { error: null, sent: true };

  redirect("/dashboard");
}
