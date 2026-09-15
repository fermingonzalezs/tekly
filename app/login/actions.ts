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

  const { error } = await signIn(
    parsed.data.email,
    parsed.data.password,
    parsed.data.rememberMe,
  );
  if (error) return { error };

  redirect("/dashboard");
}
