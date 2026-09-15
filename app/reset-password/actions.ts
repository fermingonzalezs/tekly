"use server";

import { updatePassword } from "@/lib/auth";
import { resetPasswordSchema } from "@/lib/auth/validation";

export type ResetPasswordState = { error: string | null; done?: boolean };

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { error } = await updatePassword(parsed.data.password);
  if (error) return { error };

  return { error: null, done: true };
}
