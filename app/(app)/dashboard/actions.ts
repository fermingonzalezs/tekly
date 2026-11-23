"use server";

import { revalidatePath } from "next/cache";
import { marcarPasoOnboarding, setOnboardingPasos } from "@/lib/db/configuracion";
import type { OnboardingPasoId } from "@/lib/onboarding";

export async function setOnboardingPasosAction(
  pasos: Partial<Record<OnboardingPasoId, boolean>>,
): Promise<void> {
  await setOnboardingPasos(pasos);
  revalidatePath("/dashboard");
}

export async function marcarPasoOnboardingAction(paso: OnboardingPasoId): Promise<void> {
  await marcarPasoOnboarding(paso);
  revalidatePath("/dashboard");
}
