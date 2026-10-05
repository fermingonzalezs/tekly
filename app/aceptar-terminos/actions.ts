"use server";

import { redirect } from "next/navigation";
import { aceptarTerminos } from "@/lib/auth";

export async function aceptarTerminosAction(formData: FormData): Promise<void> {
  if (formData.get("acepta") !== "on") redirect("/aceptar-terminos?error=1");
  const { error } = await aceptarTerminos();
  if (error) redirect("/aceptar-terminos?error=1");
  redirect("/dashboard");
}
