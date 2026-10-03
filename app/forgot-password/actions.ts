"use server";

import { requestPasswordReset } from "@/lib/auth";
import { forgotPasswordSchema } from "@/lib/auth/validation";

export type ForgotPasswordState = { error: string | null; sent?: boolean };

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // Mismo criterio que signup: no viaja por zod, es el token del widget de
  // Turnstile (`components/auth/turnstile-widget.tsx`).
  const captchaToken = formData.get("cf-turnstile-response");

  const { error } = await requestPasswordReset(
    parsed.data.email,
    typeof captchaToken === "string" ? captchaToken : undefined,
  );
  if (error) return { error };

  return { error: null, sent: true };
}
