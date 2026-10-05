"use client";

import Script from "next/script";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Widget de Cloudflare Turnstile, compartido por los 3 forms de auth que
 * llaman a Supabase (signup, login, forgot-password) -- "Bot and Abuse
 * Protection" en el dashboard de Supabase exige el token por igual en los
 * tres, no solo en signup (confirmado en los logs: `/token` y `/recover`
 * rechazan sin captcha_token exactamente igual que `/signup`). Sin
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no renderiza nada y el form sigue
 * funcionando igual (sin captcha, Supabase lo ignora si el dashboard no lo
 * tiene prendido). El input oculto que mete el script
 * (`cf-turnstile-response`) viaja solo con el resto del FormData porque
 * este componente se monta dentro del `<form>` que lo usa. */
export function TurnstileWidget({
  size = "normal",
  className,
}: {
  size?: "normal" | "compact" | "flexible";
  className?: string;
}) {
  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        async
        defer
      />
      <div
        className={className ? `cf-turnstile ${className}` : "cf-turnstile"}
        data-sitekey={TURNSTILE_SITE_KEY}
        data-size={size}
        data-refresh-expired="auto"
      />
    </>
  );
}
