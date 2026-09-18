"use server";

import { revalidatePath } from "next/cache";
import { setOnboardingPasos } from "@/lib/db/configuracion";
import type { OnboardingPasoId } from "@/lib/onboarding";

export async function setOnboardingPasosAction(
  pasos: Partial<Record<OnboardingPasoId, boolean>>,
): Promise<void> {
  await setOnboardingPasos(pasos);
  revalidatePath("/dashboard");
}
