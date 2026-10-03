"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Red de contención raíz -- cubre todo lo que NO tiene un `error.tsx`
 * propio (`/login`, `/signup`, `/forgot-password`, `/reset-password`,
 * `/admin`): `app/(app)/error.tsx` solo protege la app ya logueada. Mismo
 * caso de uso documentado ahí -- el 401 transitorio de Supabase por
 * desajuste de reloj entre nodos justo tras un login/signup
 * (`fetchWithClockSkewRetry` en `lib/auth/supabase.ts` ya reintenta una vez
 * antes de que llegue acá; cada submit emite un JWT nuevo, así que el mismo
 * azar puede repetirse intento tras intento). Sin este archivo, Next
 * muestra su pantalla genérica "Application error" en esas rutas. */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center p-8">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500">
          <TriangleAlert className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-neutral-900">
          Algo salió mal
        </p>
        <p className="text-sm text-neutral-500">
          Puede haber sido algo puntual. Probá de nuevo -- si sigue pasando,
          contanos qué estabas haciendo.
        </p>
        <Button onClick={() => reset()} className="mt-1">
          Reintentar
        </Button>
      </div>
    </main>
  );
}
