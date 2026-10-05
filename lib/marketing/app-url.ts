/**
 * Helper de URLs de la landing (app/marketing): los CTAs ("Ingresar",
 * "Probar gratis", ...) apuntan al sistema de gestión, que en producción
 * vive en otro dominio (sistema.tekly.tech). Único lugar que conoce el
 * default -- los componentes nunca hardcodean la URL.
 */

// En desarrollo la app corre en el mismo servidor (puerto del repo): sin esto,
// los CTAs de la landing local (Ver demo, Ingresar, Probar gratis) saltaban a
// producción, que puede no tener todavía lo que se está probando.
const DEFAULT_APP_URL =
  process.env.NODE_ENV === "production"
    ? "https://sistema.tekly.tech"
    : "http://localhost:3100";

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

/** Demo sin cuenta (plan 014): arranca en el dashboard de la demo. */
export function demoUrl(): string {
  return appUrl("/demo/dashboard");
}
