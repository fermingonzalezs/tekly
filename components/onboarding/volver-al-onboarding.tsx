"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ONBOARDING_PARAM, pasoOnboardingDesdeParam } from "@/lib/onboarding";
import { marcarPasoOnboardingAction } from "@/app/(app)/dashboard/actions";

/** Para las pantallas a las que lleva el botón "Ir" del checklist de
 * Bienvenida. Devuelve una función para llamar después de guardar con éxito:
 * si se llegó con `?onboarding=<paso>`, tilda ese paso y vuelve a /dashboard
 * (devuelve true); si no, no hace nada (false). */
export function useVolverAlOnboarding() {
  const router = useRouter();
  const paso = pasoOnboardingDesdeParam(useSearchParams().get(ONBOARDING_PARAM));

  return useCallback(async () => {
    if (!paso) return false;
    await marcarPasoOnboardingAction(paso);
    router.push("/dashboard");
    return true;
  }, [paso, router]);
}

/** Link "Volver a los primeros pasos" bajo el TopNav, solo mientras se está
 * en un paso del checklist -- para volver sin guardar nada. */
export function VolverAlOnboardingBar() {
  const paso = pasoOnboardingDesdeParam(useSearchParams().get(ONBOARDING_PARAM));
  if (!paso) return null;
  return (
    <div className="px-4 pt-3 md:px-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a los primeros pasos
      </Link>
    </div>
  );
}
