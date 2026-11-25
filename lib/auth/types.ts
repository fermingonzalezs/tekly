import type { Suscripcion } from "@/lib/planes";

export type Rol = "admin" | "vendedor" | "tecnico";

/** Usuario autenticado + su perfil de negocio (organización, roles). Es el
 * contrato que el resto de la app conoce -- nada fuera de lib/auth sabe
 * que detrás hay Supabase. */
export type SessionUser = {
  id: string;
  email: string;
  organizationId: string;
  organizationNombre: string;
  /** Roles del usuario (1 a 3). Los permisos son la **unión**: se resuelven
   * con `tieneRol` de `lib/roles.ts`, nunca comparando `rol`. */
  roles: Rol[];
  /** Rol principal derivado de `roles` por trigger en la base (`admin` >
   * `tecnico` > `vendedor`). Solo para mostrar/ordenar y para el SQL que
   * compara contra `'admin'` -- no para permisos en la app. */
  rol: Rol;
  nombre: string;
  alias: string | null;
  /** Usuario de Instagram normalizado (`lib/instagram.ts`), o `null`. */
  instagram: string | null;
  /** Versión de Términos/Privacidad aceptada (`lib/legal.ts`), o `null`. */
  terminosVersion: string | null;
  /** Plan y estado de la organización (`lib/planes.ts`). */
  suscripcion: Suscripcion;
  /** Entró por una invitación y todavía no eligió contraseña
   * (`user_metadata.debe_crear_contrasena`): el layout `(app)` lo manda a
   * `/bienvenida` hasta que la cree. */
  debeCrearContrasena: boolean;
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
