"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/components/notifications/realtime-provider";

/** Actualización en vivo del dashboard: cualquier evento de la org (venta
 * cargada, ticket listo, turno agendado, …) re-ejecuta el server component
 * (`router.refresh()` -- los datos vuelven a pasar por el filtrado por rol
 * del server). Debounce de 1,5 s: varios eventos seguidos = un solo
 * refresh. El emisor no recibe su propio evento (ver `RealtimeProvider`);
 * para él alcanza la `revalidatePath("/dashboard")` de la action. */
export function useRefrescoEnVivo() {
  const { subscribe } = useRealtime();
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 1500);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [subscribe, router]);
}
