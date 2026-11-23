"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const READY_EVENT = "tekly:turnstile-ready";

/** Widget de Cloudflare Turnstile, compartido por los 3 forms de auth que
 * llaman a Supabase (signup, login, forgot-password) -- "Bot and Abuse
 * Protection" en el dashboard de Supabase exige el token por igual en los
 * tres, no solo en signup (confirmado en los logs: `/token` y `/recover`
 * rechazan sin captcha_token exactamente igual que `/signup`). Sin
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no renderiza nada y el form sigue
 * funcionando igual (sin captcha, Supabase lo ignora si el dashboard no lo
 * tiene prendido). El input oculto que mete el script
 * (`cf-turnstile-response`) viaja solo con el resto del FormData porque
 * este componente se monta dentro del `<form>` que lo usa.
 *
 * Render **explícito** a propósito: con el render implícito (`.cf-turnstile`)
 * el script escanea el DOM una sola vez al cargar, así que al pasar de
 * `/login` a `/signup` por `next/link` (navegación cliente, el script ya
 * está cargado) el widget nuevo nunca se dibujaba y el form mandaba el token
 * vacío -- "no captcha_token found" en los logs de Auth, nadie podía
 * registrarse. Además el token es de un solo uso: `resetKey` (el `state` de
 * `useFormState`) cambia con cada respuesta de la action y fuerza un token
 * nuevo, para que un reintento después de un error no mande uno ya gastado. */
export function TurnstileWidget({
  size = "normal",
  className,
  resetKey,
}: {
  size?: "normal" | "compact" | "flexible";
  className?: string;
  resetKey?: unknown;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const render = () => {
      if (!ref.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        size,
        "refresh-expired": "auto",
      });
    };
    render();
    window.addEventListener(READY_EVENT, render);
    return () => {
      window.removeEventListener(READY_EVENT, render);
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [size]);

  const primerRender = useRef(true);
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => {
          window.dispatchEvent(new Event(READY_EVENT));
        }}
      />
      <div ref={ref} className={className} />
    </>
  );
}
