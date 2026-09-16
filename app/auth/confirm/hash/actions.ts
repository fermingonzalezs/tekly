"use server";

import { redirect } from "next/navigation";
import { safeNextPath, setSessionFromTokens } from "@/lib/auth";

export type EstablecerSesionInput = {
  accessToken: string;
  refreshToken: string;
  next: string;
};

/** Planta en cookies la sesión que Supabase devolvió en el fragmento de la
 * URL -- ver `app/auth/confirm/route.ts` y el componente de al lado. */
export async function establecerSesionAction(
  input: EstablecerSesionInput,
): Promise<{ error: string } | void> {
  const { error } = await setSessionFromTokens(
    input.accessToken,
    input.refreshToken,
  );
  if (error) return { error: "El link no es válido o ya expiró." };

  redirect(safeNextPath(input.next, "/dashboard"));
}
