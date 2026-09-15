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

  const { error } = await requestPasswordReset(parsed.data.email);
  if (error) return { error };

  return { error: null, sent: true };
}
