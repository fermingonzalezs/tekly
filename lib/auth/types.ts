export type Rol = "admin" | "vendedor" | "tecnico";

/** Usuario autenticado + su perfil de negocio (organización, rol). Es el
 * contrato que el resto de la app conoce -- nada fuera de lib/auth sabe
 * que detrás hay Supabase. */
export type SessionUser = {
  id: string;
  email: string;
  organizationId: string;
  organizationNombre: string;
  rol: Rol;
  nombre: string;
  alias: string | null;
};

export type AuthResult = { error: string | null };

/** Los 3 tipos de link de mail que `app/auth/confirm/route.ts` sabe
 * verificar -- subconjunto del `EmailOtpType` de Supabase (que además tiene
 * `magiclink`/`email_change`/`email`, sin uso hoy en la app). */
export type EmailLinkType = "signup" | "invite" | "recovery";

/** Resultado de `signUp` -- además del error, indica si Supabase exige
 * confirmar el mail antes de dejar entrar (no hay sesión todavía en ese
 * caso, así que la action no puede simplemente redirigir a /dashboard). */
export type SignUpResult = AuthResult & { needsEmailConfirmation?: boolean };

/** Nombre de la cookie propia (no la de Supabase) que decide si la sesión
 * sobrevive a cerrar el navegador. @supabase/ssr fuerza siempre 400 días de
 * vida en su propia cookie de auth -- no se puede acortar por configuración
 * -- así que "Recordarme" se controla acá: sin `maxAge` cuando está
 * destildado, el navegador la borra sola al cerrarse, y `middleware.ts` usa
 * su ausencia como señal para cortar la sesión real. */
export const REMEMBER_COOKIE_NAME = "tekly-remember";
