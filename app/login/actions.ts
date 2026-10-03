"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { loginSchema } from "@/lib/auth/validation";

export type LoginState = { error: string | null };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    rememberMe: formData.get("rememberMe") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // Mismo criterio que signup: no viaja por zod, es el token del widget de
  // Turnstile (`components/auth/turnstile-widget.tsx`).
  const captchaToken = formData.get("cf-turnstile-response");

  const { error } = await signIn(
    parsed.data.email,
    parsed.data.password,
    parsed.data.rememberMe,
    typeof captchaToken === "string" ? captchaToken : undefined,
  );
  if (error) return { error };

  redirect("/dashboard");
}
