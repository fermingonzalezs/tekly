"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { establecerSesionAction } from "./actions";

/** Lee el fragmento de la URL (`#access_token=...&refresh_token=...`) con el
 * que vuelven los links de mail que no usan PKCE -- invitaciones, sobre
 * todo -- y le pasa los tokens al server, que los guarda en cookies. El
 * fragmento no viaja en la request, así que este rodeo por el cliente es la
 * única forma de recibirlo sin editar el template del mail. */
export function HashCallback({ next }: { next: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const yaCorrio = useRef(false);

  useEffect(() => {
    if (yaCorrio.current) return; // StrictMode monta dos veces en dev
    yaCorrio.current = true;

    const params = new URLSearchParams(window.location.hash.slice(1));
    // Los tokens vienen en limpio: se sacan de la barra de direcciones antes
    // que nada, o quedan en el historial del navegador.
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) {
      setError("El link no es válido o ya expiró.");
      return;
    }

    const destino =
      next ??
      (params.get("type") === "recovery" ? "/reset-password" : "/dashboard");
    void establecerSesionAction({ accessToken, refreshToken, next: destino })
      .then((res) => {
        if (res?.error) setError(res.error);
      })
      .catch(() => setError("El link no es válido o ya expiró."));
  }, [next]);

  if (error) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-red-500">{error}</p>
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-accent"
        >
          Pedir un link nuevo
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 py-4 text-sm text-neutral-600">
      <Loader2 className="h-4 w-4 animate-spin" />
      Verificando el link…
    </div>
  );
}
