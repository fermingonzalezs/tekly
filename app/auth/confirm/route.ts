import { NextResponse, type NextRequest } from "next/server";
import { verifyEmailLink } from "@/lib/auth";
import type { EmailLinkType } from "@/lib/auth/types";

const VALID_TYPES: EmailLinkType[] = ["signup", "invite", "recovery"];

/** Destino al que redirige cada link de mail de Supabase, según su `type`
 * -- usado cuando el template no manda `next` explícito. */
const DEFAULT_NEXT: Record<EmailLinkType, string> = {
  signup: "/dashboard",
  invite: "/dashboard",
  recovery: "/reset-password",
};

/**
 * Único lugar de la app que recibe los links de los mails de Supabase Auth
 * (confirmar cuenta, aceptar invitación, recuperar contraseña). Los
 * templates tienen que armar el link como
 * `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<tipo>` --
 * no usar `{{ .ConfirmationURL }}` (apunta directo al servidor de Supabase,
 * que no sabe nada de las cookies de esta app).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next");

  if (tokenHash && type && VALID_TYPES.includes(type as EmailLinkType)) {
    const { error } = await verifyEmailLink(type as EmailLinkType, tokenHash);
    if (!error) {
      return NextResponse.redirect(
        new URL(next ?? DEFAULT_NEXT[type as EmailLinkType], origin),
      );
    }
  }

  const url = new URL("/login", origin);
  url.searchParams.set("error", "El link no es válido o ya expiró.");
  return NextResponse.redirect(url);
}
