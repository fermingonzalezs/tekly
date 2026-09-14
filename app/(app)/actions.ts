"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signOut, updateOwnProfile, type AuthResult } from "@/lib/auth";

export async function signOutAction() {
  await signOut();
  redirect("/login");
}

export async function updateOwnProfileAction(
  nombre: string,
  alias: string,
): Promise<AuthResult> {
  const result = await updateOwnProfile(nombre, alias);
  if (!result.error) revalidatePath("/", "layout");
  return result;
}
