import "server-only";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import {
  createServerClient,
  createServiceRoleClient,
} from "@/lib/auth/supabase";
import {
  REMEMBER_COOKIE_NAME,
  type AuthResult,
  type EmailLinkType,
  type Rol,
  type SessionUser,
  type SignUpResult,
} from "@/lib/auth/types";
import { safeNextPath } from "@/lib/auth/next-path";
import { authErrorMessage } from "@/lib/auth/error-messages";
import { TERMINOS_VERSION } from "@/lib/legal";
import { PLANES, cupoUsuarios, esPlanEstado, esPlanId, puedeEscribir } from "@/lib/planes";
import { normalizarInstagram } from "@/lib/instagram";
import { normalizarRoles, rolPrincipal, tieneRol } from "@/lib/roles";
import { HISTORIAL_USUARIO, resumenHistorial, type ConteoHistorial } from "@/lib/miembros";

export type { Rol, SessionUser, AuthResult, SignUpResult } from "@/lib/auth/types";
export { safeNextPath };

/** Prende/renueva la cookie que decide si la sesión sobrevive a cerrar el
 * navegador -- ver `REMEMBER_COOKIE_NAME`. Toda vía que deja a alguien
 * autenticado (login, signup sin confirmación pendiente, aceptar invitación,
 * confirmar cuenta, recuperar contraseña) tiene que llamarla: si no, la
 * próxima request la encuentra ausente y `middleware.ts` cierra la sesión
 * sola, pensando que el navegador se cerró.
 */
export async function setRememberCookie(remember: boolean) {
  (await cookies()).set({
    name: REMEMBER_COOKIE_NAME,
    value: remember ? "1" : "0",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    ...(remember ? { maxAge: 60 * 60 * 24 * 400 } : {}),
  });
}

/** Origen público de la app -- base de los `redirectTo` que Supabase mete
 * en los links de mail. `NEXT_PUBLIC_SITE_URL` manda si está seteada (en
 * producción la request puede venir por un proxy); si no, se deduce de los
 * headers de la request actual. */
async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;

  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "http://localhost:3100";
}

/** URL a la que Supabase Auth tiene que volver después de verificar un link
 * de mail. Se la pasamos a mano en cada llamada (`redirectTo` /
 * `emailRedirectTo`) en vez de depender del Site URL del dashboard: así el
 * `{{ .ConfirmationURL }}` del template **default** ya vuelve a nuestro
 * `/auth/confirm`, sin necesidad de editar el template. La URL tiene que
 * estar permitida en Authentication -> URL Configuration -> Redirect URLs. */
async function authCallbackUrl(next: string): Promise<string> {
  return `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`;
}

/** Sesión actual, o `null` si no hay usuario logueado o el usuario no tiene
 * perfil todavía (recién registrado, esperando confirmar email). */
export async function getSession(): Promise<SessionUser | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // `*` a propósito: si la migración de `profiles.roles` todavía no se
  // aplicó (dev), la columna simplemente no viene y se cae a `[rol]` -- con
  // un `select` explícito de `roles` la app entera rompería hasta aplicarla.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(nombre, plan, plan_estado, trial_termina_at, periodo_termina_at)")
    .eq("id", user.id)
    .maybeSingle<{
      organization_id: string;
      rol: Rol;
      roles: string[] | null;
      nombre: string;
      alias: string | null;
      instagram: string | null;
      terminos_version: string | null;
      organizations: {
        nombre: string;
        plan: string;
        plan_estado: string;
        trial_termina_at: string | null;
        periodo_termina_at: string | null;
      } | null;
    }>();
  if (!profile) return null;

  const org = profile.organizations;
  return {
    id: user.id,
    email: user.email ?? "",
    organizationId: profile.organization_id,
    organizationNombre: org?.nombre ?? "",
    roles: normalizarRoles(profile.roles ?? [profile.rol]),
    rol: profile.rol,
    nombre: profile.nombre,
    alias: profile.alias,
    instagram: profile.instagram,
    terminosVersion: profile.terminos_version,
    suscripcion: {
      plan: org && esPlanId(org.plan) ? org.plan : "trial",
      estado: org && esPlanEstado(org.plan_estado) ? org.plan_estado : "trial",
      trialTerminaAt: org?.trial_termina_at ?? null,
      periodoTerminaAt: org?.periodo_termina_at ?? null,
    },
    debeCrearContrasena: user.user_metadata?.debe_crear_contrasena === true,
  };
}

/** Registra que el usuario aceptó la versión vigente de Términos/Privacidad
 * (plan 012). `profiles` no tiene policy de update para `authenticated`: va
 * por service role, con el id de la sesión (nunca uno que venga del cliente). */
export async function aceptarTerminos(): Promise<AuthResult> {
  const user = await requireUser();
  const service = createServiceRoleClient();
  const { error } = await service
    .from("profiles")
    .update({
      terminos_version: TERMINOS_VERSION,
      terminos_aceptados_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  return { error: error ? error.message : null };
}

/** Para Server Components/Actions que requieren sesión -- redirige a
 * /login si no hay usuario o todavía no tiene perfil (organización). */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Como `requireUser`, pero además exige **alguno** de los roles dados (los
 * permisos de un usuario con varios roles son la unión). Usar en server
 * actions que hacen algo que un rol no debería poder hacer. */
export async function requireRole(...roles: Rol[]): Promise<SessionUser> {
  const session = await requireUser();
  if (!tieneRol(session, ...roles)) redirect("/");
  return session;
}

/** Como `requireUser`, pero además exige que la organización pueda escribir
 * (prueba en curso o plan al día, ver `lib/planes.ts`). Va en toda server
 * action que muta datos de negocio; si la cuenta está en solo lectura manda
 * a `/plan`, que explica qué pasó y cómo seguir. */
export async function requireEscritura(): Promise<SessionUser> {
  const session = await requireUser();
  if (!puedeEscribir(session.suscripcion)) redirect("/plan");
  return session;
}

/** `requireRole` + `requireEscritura`. */
export async function requireRoleEscritura(...roles: Rol[]): Promise<SessionUser> {
  const session = await requireRole(...roles);
  if (!puedeEscribir(session.suscripcion)) redirect("/plan");
  return session;
}

/** Allowlist de admins de plataforma -- emails separados por comas en
 * `PLATFORM_ADMIN_EMAILS` (server-only). Identidad de plataforma a propósito
 * fuera de la base: alcanza para 1-2 personas (el dueño del SaaS); el día que
 * haga falta un equipo de soporte, ahí sí una columna `is_platform_admin`.
 * El admin de plataforma sigue siendo un usuario normal con su propia
 * organización/perfil -- esta variable solo lo habilita además a entrar a
 * `/admin`. */
const PLATFORM_ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Sesión de un admin de plataforma -- redirige a `/` si el email de la
 * sesión no está en la allowlist (o si no hay sesión). Gate de todo lo que
 * cuelga de `/admin`: el layout de esa ruta y cada una de sus server
 * actions -- ver `lib/db/admin.ts` (que corre por service role y confía en
 * que quien la llama ya pasó por acá). */
/** ¿El email está en la allowlist de plataforma? (para mostrar el acceso a
 * `/admin` en el menú; el gate real sigue siendo `requirePlatformAdmin`). */
export function esAdminPlataforma(email: string): boolean {
  return PLATFORM_ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const session = await requireUser();
  if (!esAdminPlataforma(session.email)) {
    redirect("/");
  }
  return session;
}

export async function signIn(
  email: string,
  password: string,
  rememberMe: boolean,
  /** Token del widget de Turnstile (`components/auth/turnstile-widget.tsx`)
   * -- Supabase lo exige por igual en login/signup/recover una vez que
   * "Bot and Abuse Protection" está prendido en el dashboard (confirmado en
   * `auth_logs`: los tres rutas rechazan sin `captcha_token` por igual, no
   * solo `/signup`). Mismo criterio opcional que `signUp`: si el dashboard
   * no tiene el captcha prendido, Supabase ignora el campo. */
  captchaToken?: string,
): Promise<AuthResult> {
  const supabase = createServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });
  if (error) return { error: authErrorMessage(error.message) };

  await setRememberCookie(rememberMe);
  return { error: null };
}

export async function signOut(): Promise<void> {
  const supabase = createServerClient();
  await supabase.auth.signOut();
  (await cookies()).delete(REMEMBER_COOKIE_NAME);
}

/** Signup self-serve: crea el usuario de auth, su organización nueva y su
 * perfil como admin. Usa service role para los dos inserts porque
 * `organizations`/`profiles` no tienen policy de insert para `authenticated`
 * -- la única vía de alta es este flujo (o `inviteMember` de abajo). */
export async function signUp(params: {
  email: string;
  password: string;
  nombre: string;
  organizacionNombre: string;
  /** Versión de los Términos/Privacidad que aceptó en el form (`lib/legal.ts`);
   * se guarda en el perfil junto con la fecha. */
  terminosVersion: string | null;
  /** Token del widget de Turnstile (`signup-form.tsx`) -- Supabase lo valida
   * server-side contra el secret key configurado en el dashboard
   * (Authentication -> Settings -> Bot and Abuse Protection); esta app nunca
   * ve ese secret, solo la site key pública (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
   * ver `.env.local.example`) que renderiza el widget. Opcional a propósito:
   * si el dashboard no tiene el captcha prendido, Supabase ignora el campo
   * en vez de rechazar el signup -- no bloquea el flujo mientras se activa. */
  captchaToken?: string;
}): Promise<SignUpResult> {
  const supabase = createServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      emailRedirectTo: await authCallbackUrl("/dashboard"),
      // Queda en el user_metadata -- disponible como `{{ .Data.nombre }}`
      // en el mail de "Confirm signup" (y, después, en el de "Reset
      // Password" de este mismo usuario), mismo mecanismo que ya usa
      // `inviteMember` más abajo.
      data: { nombre: params.nombre },
      captchaToken: params.captchaToken,
    },
  });
  if (error) return { error: authErrorMessage(error.message) };
  if (!data.user) return { error: "No se pudo crear el usuario." };

  // De acá para abajo, cualquier falla hace rollback del usuario de auth
  // (y de la organización, si ya se llegó a crear) -- sin esto, un error a
  // mitad de camino deja una cuenta fantasma sin perfil que bloquea
  // reintentar con el mismo email ("ya registrado") sin poder loguearse
  // nunca (no tiene perfil).
  let service: ReturnType<typeof createServiceRoleClient>;
  try {
    service = createServiceRoleClient();
  } catch (e) {
    // Sin service role no hay forma de limpiar el usuario de auth recién
    // creado (el admin API también la necesita) -- error de configuración,
    // no de datos: se resuelve arreglando el entorno, no reintentando.
    return {
      error: e instanceof Error ? e.message : "Error de configuración del servidor.",
    };
  }

  const { data: org, error: orgError } = await service
    .from("organizations")
    .insert({ nombre: params.organizacionNombre })
    .select("id")
    .single();
  if (orgError) {
    await service.auth.admin.deleteUser(data.user.id);
    return { error: authErrorMessage(orgError.message) };
  }

  const { error: profileError } = await service.from("profiles").insert({
    id: data.user.id,
    organization_id: org.id,
    rol: "admin" satisfies Rol,
    nombre: params.nombre,
    email: params.email,
    terminos_version: params.terminosVersion,
    terminos_aceptados_at: params.terminosVersion ? new Date().toISOString() : null,
  });
  if (profileError) {
    await service.from("organizations").delete().eq("id", org.id);
    await service.auth.admin.deleteUser(data.user.id);
    return { error: authErrorMessage(profileError.message) };
  }

  // Con "Confirm email" prendido en Supabase, `signUp` no devuelve sesión
  // hasta que el usuario confirma por mail -- la action de arriba no puede
  // asumir que ya está logueado. Con "Confirm email" apagado (dev), sí hay
  // sesión ya: se la recuerda igual que un login (ver `setRememberCookie`)
  // para que la próxima request no la encuentre "sin recordar" y la cierre.
  if (data.session) {
    await setRememberCookie(true);
    return { error: null, needsEmailConfirmation: false };
  }
  return { error: null, needsEmailConfirmation: true };
}

/** Invita a un usuario nuevo a la organización del admin que llama. Envía
 * el mail de invitación de Supabase Auth (magic link para setear
 * contraseña) y crea el perfil ya asociado a la org + roles elegidos.
 *
 * Instagram salió del alta (plan 029): se carga después, desde la edición
 * del miembro o desde "Mi cuenta". */
export async function inviteMember(params: {
  email: string;
  nombre: string;
  roles: Rol[];
}): Promise<AuthResult> {
  const caller = await requireRoleEscritura("admin");
  const roles = normalizarRoles(params.roles);
  if (roles.length === 0) return { error: "Elegí al menos un rol." };

  const service = createServiceRoleClient();

  // Email que ya es de un usuario de esta org (caso típico: lo desactivaron y
  // lo quieren invitar de nuevo) → mensaje claro en vez del "already
  // registered" de Supabase.
  const { data: perfilesOrg } = await service
    .from("profiles")
    .select("email, activo")
    .eq("organization_id", caller.organizationId);
  const emailBuscado = params.email.trim().toLowerCase();
  const existente = (perfilesOrg ?? []).find(
    (p) => (p.email as string).trim().toLowerCase() === emailBuscado,
  );
  if (existente) {
    return {
      error: existente.activo
        ? "Ese email ya es un usuario de tu organización. Si no le llegó la invitación, abrilo en la lista y tocá «Reenviar invitación»."
        : "Ese email es de un usuario desactivado. Abrilo en la lista y tocá «Reactivar usuario».",
    };
  }

  // Cupo de usuarios del plan (`lib/planes.ts`): cuenta los perfiles activos,
  // incluidas las invitaciones todavía sin aceptar.
  const { count: usados, error: cupoError } = await service
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", caller.organizationId)
    .eq("activo", true);
  if (cupoError) return { error: cupoError.message };
  const cupo = cupoUsuarios(caller.suscripcion.plan, usados ?? 0);
  if (cupo.lleno) {
    return {
      error: `Tu plan ${PLANES[caller.suscripcion.plan].label} permite hasta ${cupo.max} ${
        cupo.max === 1 ? "usuario" : "usuarios"
      }. Cambiá de plan para sumar más.`,
    };
  }

  const { data, error } = await service.auth.admin.inviteUserByEmail(
    params.email,
    // `data` queda disponible como `{{ .Data.organizacion }}`/`{{ .Data.nombre }}`
    // en el template de mail "Invite user" del dashboard de Supabase.
    {
      // `debe_crear_contrasena`: el invitado entra con la sesión del link y
      // nunca eligió contraseña -- el layout `(app)` lo manda a `/bienvenida`
      // hasta que la cree (`crearContrasenaInvitado`).
      data: {
        organizacion: caller.organizationNombre,
        nombre: params.nombre,
        debe_crear_contrasena: true,
      },
      redirectTo: await authCallbackUrl("/bienvenida"),
    },
  );
  if (error) return { error: error.message };
  if (!data.user) return { error: "No se pudo invitar al usuario." };

  const { error: profileError } = await service.from("profiles").insert({
    id: data.user.id,
    organization_id: caller.organizationId,
    // El trigger de la base normaliza `roles` y deriva `rol` (principal).
    roles,
    rol: rolPrincipal(roles),
    nombre: params.nombre,
    email: params.email,
  });
  if (profileError) return { error: profileError.message };

  return { error: null };
}

/** Dispara el mail de "restablecer contraseña" de Supabase Auth. Siempre
 * devuelve éxito salvo error de configuración/rate limit -- Supabase no
 * distingue "el mail no existe" para no filtrar qué emails están
 * registrados, así que la pantalla de "olvidé mi contraseña" muestra el
 * mismo mensaje exista o no la cuenta. */
export async function requestPasswordReset(
  email: string,
  /** Ver comentario de `captchaToken` en `signIn` -- mismo criterio. */
  captchaToken?: string,
): Promise<AuthResult> {
  const supabase = createServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: await authCallbackUrl("/reset-password"),
    captchaToken,
  });
  return { error: error ? authErrorMessage(error.message) : null };
}

/** Verifica el link de un mail de Supabase (confirmar cuenta, aceptar
 * invitación o recuperar contraseña) y deja la sesión activa vía cookies --
 * la llama `app/auth/confirm/route.ts`. Si sale bien, la sesión recién
 * creada se marca "recordada" (ver `setRememberCookie`): son logins
 * explícitos desde un link de mail, no pasan por el checkbox de /login. */
export async function verifyEmailLink(
  type: EmailLinkType,
  tokenHash: string,
): Promise<AuthResult> {
  const supabase = createServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });
  if (error) return { error: authErrorMessage(error.message) };

  await setRememberCookie(true);
  return { error: null };
}

/** Contraparte de `verifyEmailLink` para el template **default** de
 * Supabase (el que no se puede editar sin SMTP propio): su
 * `{{ .ConfirmationURL }}` no trae `token_hash`, manda al `/auth/v1/verify`
 * del propio Supabase, que verifica el token él mismo y vuelve a nuestro
 * `redirectTo` con un `?code=` -- el flujo PKCE, que es el que usa
 * @supabase/ssr. Canjear ese code por una sesión necesita el `code_verifier`
 * que quedó en una cookie cuando se pidió el mail: por eso el link tiene que
 * abrirse en el mismo navegador desde el que se pidió. */
export async function exchangeEmailCode(code: string): Promise<AuthResult> {
  const supabase = createServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return { error: authErrorMessage(error.message) };

  await setRememberCookie(true);
  return { error: null };
}

/** Igual que `exchangeEmailCode`, pero para los links que vuelven con la
 * sesión ya emitida en el fragmento (`#access_token=...`): los que genera el
 * admin API (invitaciones) no pasan por PKCE. El fragmento no llega nunca al
 * server, así que los tokens los manda `app/auth/confirm/hash/`. */
export async function setSessionFromTokens(
  accessToken: string,
  refreshToken: string,
): Promise<AuthResult> {
  const supabase = createServerClient();
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) return { error: authErrorMessage(error.message) };

  await setRememberCookie(true);
  return { error: null };
}

/** Setea la contraseña nueva -- se llama ya con la sesión de recuperación
 * activa (la crea `app/auth/confirm/route.ts` al verificar el link del
 * mail), no recibe la contraseña vieja. */
/** Pantalla `/bienvenida`: el invitado que entró por el link del mail elige
 * su contraseña (y confirma su nombre). Baja el flag
 * `debe_crear_contrasena` en el mismo `updateUser`, así el layout deja de
 * mandarlo acá. El nombre va por la RPC de siempre (`update_own_profile`). */
export async function crearContrasenaInvitado(
  nombre: string,
  password: string,
): Promise<AuthResult> {
  const user = await requireUser();
  const supabase = createServerClient();
  const { error } = await supabase.auth.updateUser({
    password,
    data: { debe_crear_contrasena: false },
  });
  if (error) return { error: authErrorMessage(error.message) };

  if (nombre.trim() !== user.nombre) {
    const { error: perfilError } = await supabase.rpc("update_own_profile", {
      new_nombre: nombre.trim(),
      new_alias: user.alias,
    });
    if (perfilError) return { error: perfilError.message };
  }
  return { error: null };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const supabase = createServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  return { error: error ? authErrorMessage(error.message) : null };
}

/** Actualiza el propio nombre/alias -- vía RPC porque `profiles` no tiene
 * policy de update para `authenticated` (evita que alguien reasigne su
 * propio rol/organización escribiendo directo a la tabla). */
export async function updateOwnProfile(
  nombre: string,
  alias?: string,
  /** `undefined` = no tocarlo; `""` = borrarlo. */
  instagram?: string,
): Promise<AuthResult> {
  let igUsuario: string | null | undefined;
  if (instagram !== undefined) {
    const ig = normalizarInstagram(instagram);
    if (!ig.ok) return { error: ig.error };
    igUsuario = ig.usuario;
  }
  const supabase = createServerClient();
  const { error } = await supabase.rpc("update_own_profile", {
    new_nombre: nombre,
    new_alias: alias ?? null,
  });
  if (error) return { error: error.message };
  if (igUsuario !== undefined) {
    const { error: igError } = await supabase.rpc("set_own_instagram", {
      new_instagram: igUsuario ?? "",
    });
    if (igError) return { error: igError.message };
  }
  return { error: null };
}

/** Cambia los roles de otro miembro de la organización -- vía RPC, que valida
 * server-side que quien llama es admin de esa misma organización, que los
 * roles sean válidos y que no quede la org sin ningún admin activo. */
export async function setMemberRoles(
  targetProfileId: string,
  roles: Rol[],
): Promise<AuthResult> {
  const normalizados = normalizarRoles(roles);
  if (normalizados.length === 0) return { error: "Elegí al menos un rol." };
  const supabase = createServerClient();
  const { error } = await supabase.rpc("set_member_roles", {
    target_profile_id: targetProfileId,
    new_roles: normalizados,
  });
  return { error: error?.message ?? null };
}

/** Valida que `targetProfileId` sea un perfil de la misma organización que
 * el admin que llama -- chequeo común a `deactivateMember`/`setMemberEmail`,
 * que no pueden pasar por una RPC (necesitan el admin API de Auth, que solo
 * está disponible server-side vía service role, no en SQL). */
async function requireMemberOfCallerOrg(
  service: ReturnType<typeof createServiceRoleClient>,
  callerOrgId: string,
  targetProfileId: string,
): Promise<string | null> {
  const { data: target, error } = await service
    .from("profiles")
    .select("organization_id")
    .eq("id", targetProfileId)
    .maybeSingle();
  if (error) return error.message;
  if (!target || target.organization_id !== callerOrgId) {
    return "El usuario no pertenece a tu organización.";
  }
  return null;
}

/** Da de baja a un miembro de la organización. Nunca un `DELETE` real:
 * `tickets.tecnico_id`, `ventas.vendedor_id`, `movimientos_caja.usuario_id`,
 * etc. referencian `profiles.id` sin cascada -- borrar la fila rompería en
 * cuanto el usuario tuviera algo de historial (una venta, un ticket
 * asignado). Mismo criterio de "baja lógica" que celulares/repuestos/otros:
 * `profiles.activo = false` (ya mostrado como "Inactivo" en la UI) +
 * `ban_duration` en Supabase Auth para que además no pueda loguearse de
 * nuevo -- Supabase revalida el ban al refrescar el token, así que también
 * corta una sesión ya abierta, no solo logins futuros. Se deshace con
 * `reactivateMember`. Un miembro **sin historial** se puede borrar de verdad
 * con `deleteMember`. */
export async function deactivateMember(targetProfileId: string): Promise<AuthResult> {
  const caller = await requireRoleEscritura("admin");
  if (targetProfileId === caller.id) {
    return { error: "No podés desactivar tu propio usuario." };
  }

  const service = createServiceRoleClient();
  const orgError = await requireMemberOfCallerOrg(service, caller.organizationId, targetProfileId);
  if (orgError) return { error: orgError };

  const { error: banError } = await service.auth.admin.updateUserById(targetProfileId, {
    ban_duration: "876000h",
  });
  if (banError) return { error: banError.message };

  const { error: profileError } = await service
    .from("profiles")
    .update({ activo: false })
    .eq("id", targetProfileId);
  if (profileError) return { error: profileError.message };

  return { error: null };
}

/** Cuántas filas de cada tabla de `HISTORIAL_USUARIO` (`lib/miembros.ts`)
 * apuntan al usuario. Por service role: `reportes_bugs` no tiene policy de
 * select, y el id ya se validó contra la org de quien llama. */
async function contarHistorial(
  service: ReturnType<typeof createServiceRoleClient>,
  targetProfileId: string,
): Promise<{ conteos: ConteoHistorial[]; error: string | null }> {
  const resultados = await Promise.all(
    HISTORIAL_USUARIO.map(async (h) => {
      const { count, error } = await service
        .from(h.tabla)
        .select(h.columna, { count: "exact", head: true })
        .eq(h.columna, targetProfileId);
      return { h, count: count ?? 0, error };
    }),
  );
  const fallo = resultados.find((r) => r.error);
  if (fallo?.error) return { conteos: [], error: fallo.error.message };
  return {
    conteos: resultados.map((r) => ({ singular: r.h.singular, plural: r.h.plural, cantidad: r.count })),
    error: null,
  };
}

/** Historial del miembro: decide si el dialog ofrece «Eliminar» (sin
 * historial) o «Desactivar» (con historial), y con qué texto. */
export async function getHistorialMember(
  targetProfileId: string,
): Promise<{ error: string | null; tieneHistorial: boolean; resumen: string }> {
  const caller = await requireRole("admin");
  const service = createServiceRoleClient();
  const orgError = await requireMemberOfCallerOrg(service, caller.organizationId, targetProfileId);
  if (orgError) return { error: orgError, tieneHistorial: true, resumen: "" };
  const { conteos, error } = await contarHistorial(service, targetProfileId);
  if (error) return { error, tieneHistorial: true, resumen: "" };
  const resumen = resumenHistorial(conteos);
  return { error: null, tieneHistorial: resumen !== "", resumen };
}

/** Deshace `deactivateMember`: levanta el ban de Auth y vuelve a marcar el
 * perfil activo. Respeta el cupo de usuarios del plan, igual que invitar. */
export async function reactivateMember(targetProfileId: string): Promise<AuthResult> {
  const caller = await requireRoleEscritura("admin");
  const service = createServiceRoleClient();
  const orgError = await requireMemberOfCallerOrg(service, caller.organizationId, targetProfileId);
  if (orgError) return { error: orgError };

  const { count: usados, error: cupoError } = await service
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", caller.organizationId)
    .eq("activo", true);
  if (cupoError) return { error: cupoError.message };
  const cupo = cupoUsuarios(caller.suscripcion.plan, usados ?? 0);
  if (cupo.lleno) {
    return {
      error: `Tu plan ${PLANES[caller.suscripcion.plan].label} permite hasta ${cupo.max} ${
        cupo.max === 1 ? "usuario activo" : "usuarios activos"
      }. Desactivá a otro o cambiá de plan.`,
    };
  }

  const { error: banError } = await service.auth.admin.updateUserById(targetProfileId, {
    ban_duration: "none",
  });
  if (banError) return { error: banError.message };

  const { error: profileError } = await service
    .from("profiles")
    .update({ activo: true })
    .eq("id", targetProfileId);
  if (profileError) return { error: profileError.message };

  return { error: null };
}

/** Vuelve a mandar el mail de invitación a un miembro activo que todavía no
 * la aceptó (el mail no llegó o el link venció). Supabase reenvía la
 * invitación mientras el usuario no haya confirmado el email; si ya la
 * aceptó, lo que corresponde es «¿Olvidaste tu contraseña?» en el login. */
export async function resendInvite(targetProfileId: string): Promise<AuthResult> {
  const caller = await requireRoleEscritura("admin");
  const service = createServiceRoleClient();
  const orgError = await requireMemberOfCallerOrg(service, caller.organizationId, targetProfileId);
  if (orgError) return { error: orgError };

  const { data: perfil, error: perfilError } = await service
    .from("profiles")
    .select("nombre, email, activo")
    .eq("id", targetProfileId)
    .single();
  if (perfilError) return { error: perfilError.message };
  if (!perfil.activo) return { error: "Reactivá el usuario antes de reenviarle la invitación." };

  const { data: auth, error: authError } = await service.auth.admin.getUserById(targetProfileId);
  if (authError) return { error: authError.message };
  if (auth.user?.email_confirmed_at) {
    return {
      error:
        "Este usuario ya aceptó la invitación. Si no recuerda la contraseña, que use «¿Olvidaste tu contraseña?» en el login.",
    };
  }

  const { error } = await service.auth.admin.inviteUserByEmail(perfil.email, {
    data: {
      organizacion: caller.organizationNombre,
      nombre: perfil.nombre,
      debe_crear_contrasena: true,
    },
    redirectTo: await authCallbackUrl("/bienvenida"),
  });
  if (error) return { error: error.message };
  return { error: null };
}

/** Borra de verdad a un miembro **sin historial** (ni ventas, ni tickets, ni
 * movimientos: ver `HISTORIAL_USUARIO`). Se borra el usuario de Auth y el
 * perfil cae por cascada (`profiles_id_fkey`), así el email queda libre para
 * invitarlo de nuevo. Con historial, solo se puede desactivar. */
export async function deleteMember(targetProfileId: string): Promise<AuthResult> {
  const caller = await requireRoleEscritura("admin");
  if (targetProfileId === caller.id) {
    return { error: "No podés eliminar tu propio usuario." };
  }
  const service = createServiceRoleClient();
  const orgError = await requireMemberOfCallerOrg(service, caller.organizationId, targetProfileId);
  if (orgError) return { error: orgError };

  // Se recuenta acá: el dialog pudo quedar abierto mientras el usuario vendía.
  const { conteos, error: histError } = await contarHistorial(service, targetProfileId);
  if (histError) return { error: histError };
  const resumen = resumenHistorial(conteos);
  if (resumen) {
    return { error: `No se puede eliminar: tiene ${resumen}. Desactivalo para que pierda el acceso.` };
  }

  const { error } = await service.auth.admin.deleteUser(targetProfileId);
  if (error) {
    // Una FK nueva sin cascada que no esté en HISTORIAL_USUARIO cae acá.
    return { error: `No se pudo eliminar el usuario (${error.message}). Desactivalo en su lugar.` };
  }
  return { error: null };
}

/** Re-vincula la cuenta de un miembro a otro email (se equivocaron al
 * invitar, o el empleado cambió de casilla) -- admin-only. Va directo por
 * el admin API con `email_confirm: true`: es un cambio administrativo, no
 * autoservicio, no hace falta que el mail nuevo confirme por link (eso es
 * el flujo de `/auth/confirm` para el propio usuario). `profiles.email`
 * es una copia desnormalizada para no tener que ir a `auth.users` en cada
 * lectura -- se actualiza en el mismo paso para no desincronizarse. */
export async function setMemberEmail(
  targetProfileId: string,
  nuevoEmail: string,
): Promise<AuthResult> {
  const caller = await requireRoleEscritura("admin");

  const service = createServiceRoleClient();
  const orgError = await requireMemberOfCallerOrg(service, caller.organizationId, targetProfileId);
  if (orgError) return { error: orgError };

  const { error: authError } = await service.auth.admin.updateUserById(targetProfileId, {
    email: nuevoEmail,
    email_confirm: true,
  });
  if (authError) return { error: authError.message };

  const { error: profileError } = await service
    .from("profiles")
    .update({ email: nuevoEmail })
    .eq("id", targetProfileId);
  if (profileError) return { error: profileError.message };

  return { error: null };
}

/** El admin carga/corrige el Instagram de otro miembro de su organización
 * (service role, mismo criterio que `setMemberEmail`). `""` lo borra. */
export async function setMemberInstagram(
  targetProfileId: string,
  instagram: string,
): Promise<AuthResult> {
  const caller = await requireRoleEscritura("admin");
  const ig = normalizarInstagram(instagram);
  if (!ig.ok) return { error: ig.error };

  const service = createServiceRoleClient();
  const orgError = await requireMemberOfCallerOrg(service, caller.organizationId, targetProfileId);
  if (orgError) return { error: orgError };

  const { error } = await service
    .from("profiles")
    .update({ instagram: ig.usuario })
    .eq("id", targetProfileId);
  return { error: error?.message ?? null };
}
