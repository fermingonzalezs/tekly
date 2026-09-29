/**
 * Helper de URLs de la landing (app/marketing): los CTAs ("Ingresar",
 * "Probar gratis", ...) apuntan al sistema de gestión, que en producción
 * vive en otro dominio (sistema.tekly.tech). Único lugar que conoce el
 * default -- los componentes nunca hardcodean la URL.
 */

const DEFAULT_APP_URL = "https://sistema.tekly.tech";

export function appUrl(path = ""): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL;
  return `${base.replace(/\/$/, "")}${path}`;
}

export function loginUrl(): string {
  return appUrl("/login");
}

export function signupUrl(): string {
  return appUrl("/signup");
}
