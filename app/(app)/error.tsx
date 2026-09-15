"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Red de contención para cualquier error server-side sin manejar dentro de
 * la app (ej. el 401 transitorio de Supabase por desajuste de reloj entre
 * nodos justo tras un login -- ver `fetchWithClockSkewRetry` en
 * `lib/auth/supabase.ts`, que ya reintenta esos antes de que lleguen acá).
 * Sin este archivo, Next muestra su pantalla genérica "Application error". */
export default function AppError({
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
    <main className="grid min-h-[60vh] place-items-center p-8">
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
