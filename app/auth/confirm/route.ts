import { NextResponse, type NextRequest } from "next/server";
import { exchangeEmailCode, safeNextPath, verifyEmailLink } from "@/lib/auth";
import type { EmailLinkType } from "@/lib/auth/types";

const VALID_TYPES: EmailLinkType[] = ["signup", "invite", "recovery"];

/** Destino al que redirige cada link de mail de Supabase, según su `type`
 * -- usado cuando el link no trae un `next` explícito. */
const DEFAULT_NEXT: Record<EmailLinkType, string> = {
  signup: "/dashboard",
  invite: "/dashboard",
  recovery: "/reset-password",
};

const LINK_INVALIDO = "El link no es válido o ya expiró.";
/** `exchangeCodeForSession` sin la cookie del code verifier: el link se
 * abrió en otro navegador/dispositivo que el que pidió el mail. */
const OTRO_NAVEGADOR =
  "Abrí el link en el mismo navegador donde pediste el mail.";

function alLogin(origin: string, mensaje: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", mensaje);
  return NextResponse.redirect(url);
}

/**
 * Único lugar de la app que recibe los links de los mails de Supabase Auth
 * (confirmar cuenta, aceptar invitación, recuperar contraseña). Soporta las
 * tres formas en las que puede llegar la credencial, porque dependen de qué
 * template mandó el mail:
 *
 * 1. `?token_hash=...&type=...` -- template propio
 *    (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<tipo>`).
 *    Verificamos nosotros el token.
 * 2. `?code=...` -- template **default** (`{{ .ConfirmationURL }}`): el link
 *    va al `/auth/v1/verify` de Supabase, que verifica el token y rebota
 *    acá con el code del flujo PKCE. Lo canjeamos por la sesión.
 * 3. nada en la query -- la sesión (o el error) viene en el fragmento
 *    `#access_token=...`, que el navegador nunca manda al server: se lo pasa
 *    a `/auth/confirm/hash`, que lo lee con JS.
 *
 * O sea: editar los templates del dashboard es opcional (2 y 3 cubren el
 * default), pero el `redirectTo` que arma `lib/auth` tiene que estar en
 * Authentication -> URL Configuration -> Redirect URLs.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next");

  // Un link vencido avisa por la query solo en el flujo PKCE; en el
  // implícito el error viaja en el fragmento (lo maneja /auth/confirm/hash).
  if (searchParams.get("error")) return alLogin(origin, LINK_INVALIDO);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (tokenHash && type && VALID_TYPES.includes(type as EmailLinkType)) {
    const { error } = await verifyEmailLink(type as EmailLinkType, tokenHash);
    if (error) return alLogin(origin, LINK_INVALIDO);
    return NextResponse.redirect(
      new URL(
        safeNextPath(next, DEFAULT_NEXT[type as EmailLinkType]),
        origin,
      ),
    );
  }

  const code = searchParams.get("code");
  if (code) {
    const { error } = await exchangeEmailCode(code);
    if (error) {
      return alLogin(
        origin,
        /verifier/i.test(error) ? OTRO_NAVEGADOR : LINK_INVALIDO,
      );
    }
    return NextResponse.redirect(
      new URL(safeNextPath(next, "/dashboard"), origin),
    );
  }

  // El fragmento sobrevive a este redirect: el navegador lo arrastra porque
  // el `Location` no trae uno propio.
  const hashUrl = new URL("/auth/confirm/hash", origin);
  if (next) hashUrl.searchParams.set("next", next);
  return NextResponse.redirect(hashUrl);
}
