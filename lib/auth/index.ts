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

export type { Rol, SessionUser, AuthResult, SignUpResult } from "@/lib/auth/types";

/** Prende/renueva la cookie que decide si la sesión sobrevive a cerrar el
 * navegador -- ver `REMEMBER_COOKIE_NAME`. Toda vía que deja a alguien
 * autenticado (login, signup sin confirmación pendiente, aceptar invitación,
 * confirmar cuenta, recuperar contraseña) tiene que llamarla: si no, la
 * próxima request la encuentra ausente y `middleware.ts` cierra la sesión
 * sola, pensando que el navegador se cerró.
 */
export function setRememberCookie(remember: boolean) {
  cookies().set({
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
function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const h = headers();
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
function authCallbackUrl(next: string): string {
  return `${siteOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`;
}

/** El `next` de un link de mail es querystring: solo se acepta una ruta
 * interna. Sin esto, `?next=https://otro-sitio` sería un open redirect. */
export function safeNextPath(
  next: string | null | undefined,
  fallback: string,
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

/** Sesión actual, o `null` si no hay usuario logueado o el usuario no tiene
 * perfil todavía (recién registrado, esperando confirmar email). */
export async function getSession(): Promise<SessionUser | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, rol, nombre, alias, organizations(nombre)")
    .eq("id", user.id)
    .maybeSingle<{
      organization_id: string;
      rol: Rol;
      nombre: string;
      alias: string | null;
      organizations: { nombre: string } | null;
    }>();
  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    organizationId: profile.organization_id,
    organizationNombre: profile.organizations?.nombre ?? "",
    rol: profile.rol,
    nombre: profile.nombre,
    alias: profile.alias,
  };
}

/** Para Server Components/Actions que requieren sesión -- redirige a
 * /login si no hay usuario o todavía no tiene perfil (organización). */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Como `requireUser`, pero además exige uno de los roles dados. Usar en
 * server actions que hacen algo que un rol no debería poder hacer. */
export async function requireRole(...roles: Rol[]): Promise<SessionUser> {
  const session = await requireUser();
  if (!roles.includes(session.rol)) redirect("/");
  return session;
}

export async function signIn(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<AuthResult> {
  const supabase = createServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };

  setRememberCookie(rememberMe);
  return { error: null };
}

export async function signOut(): Promise<void> {
  const supabase = createServerClient();
  await supabase.auth.signOut();
  cookies().delete(REMEMBER_COOKIE_NAME);
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
}): Promise<SignUpResult> {
  const supabase = createServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: { emailRedirectTo: authCallbackUrl("/dashboard") },
  });
  if (error) return { error: error.message };
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
    return { error: orgError.message };
  }

  const { error: profileError } = await service.from("profiles").insert({
    id: data.user.id,
    organization_id: org.id,
    rol: "admin" satisfies Rol,
    nombre: params.nombre,
    email: params.email,
  });
  if (profileError) {
    await service.from("organizations").delete().eq("id", org.id);
    await service.auth.admin.deleteUser(data.user.id);
    return { error: profileError.message };
  }

  // Con "Confirm email" prendido en Supabase, `signUp` no devuelve sesión
  // hasta que el usuario confirma por mail -- la action de arriba no puede
  // asumir que ya está logueado. Con "Confirm email" apagado (dev), sí hay
  // sesión ya: se la recuerda igual que un login (ver `setRememberCookie`)
  // para que la próxima request no la encuentre "sin recordar" y la cierre.
  if (data.session) {
    setRememberCookie(true);
    return { error: null, needsEmailConfirmation: false };
  }
  return { error: null, needsEmailConfirmation: true };
}

/** Invita a un usuario nuevo a la organización del admin que llama. Envía
 * el mail de invitación de Supabase Auth (magic link para setear
 * contraseña) y crea el perfil ya asociado a la org + rol elegido. */
export async function inviteMember(params: {
  email: string;
  nombre: string;
  rol: Rol;
}): Promise<AuthResult> {
  const caller = await requireRole("admin");

  const service = createServiceRoleClient();
  const { data, error } = await service.auth.admin.inviteUserByEmail(
    params.email,
    // `data` queda disponible como `{{ .Data.organizacion }}`/`{{ .Data.nombre }}`
    // en el template de mail "Invite user" del dashboard de Supabase.
    {
      data: { organizacion: caller.organizationNombre, nombre: params.nombre },
      redirectTo: authCallbackUrl("/dashboard"),
    },
  );
  if (error) return { error: error.message };
  if (!data.user) return { error: "No se pudo invitar al usuario." };

  const { error: profileError } = await service.from("profiles").insert({
    id: data.user.id,
    organization_id: caller.organizationId,
    rol: params.rol,
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
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const supabase = createServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authCallbackUrl("/reset-password"),
  });
  return { error: error?.message ?? null };
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
  if (error) return { error: error.message };

  setRememberCookie(true);
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
  if (error) return { error: error.message };

  setRememberCookie(true);
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
  if (error) return { error: error.message };

  setRememberCookie(true);
  return { error: null };
}

/** Setea la contraseña nueva -- se llama ya con la sesión de recuperación
 * activa (la crea `app/auth/confirm/route.ts` al verificar el link del
 * mail), no recibe la contraseña vieja. */
export async function updatePassword(password: string): Promise<AuthResult> {
  const supabase = createServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  return { error: error?.message ?? null };
}

/** Actualiza el propio nombre/alias -- vía RPC porque `profiles` no tiene
 * policy de update para `authenticated` (evita que alguien reasigne su
 * propio rol/organización escribiendo directo a la tabla). */
export async function updateOwnProfile(
  nombre: string,
  alias?: string,
): Promise<AuthResult> {
  const supabase = createServerClient();
  const { error } = await supabase.rpc("update_own_profile", {
    new_nombre: nombre,
    new_alias: alias ?? null,
  });
  return { error: error?.message ?? null };
}

/** Cambia el rol de otro miembro de la organización -- vía RPC, que valida
 * server-side que quien llama es admin de esa misma organización. */
export async function setMemberRole(
  targetProfileId: string,
  nuevoRol: Rol,
): Promise<AuthResult> {
  const supabase = createServerClient();
  const { error } = await supabase.rpc("set_member_role", {
    target_profile_id: targetProfileId,
    new_rol: nuevoRol,
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
 * asignado). Mismo criterio de "baja lógica" que equipos/repuestos/otros:
 * `profiles.activo = false` (ya mostrado como "Inactivo" en la UI) +
 * `ban_duration` en Supabase Auth para que además no pueda loguearse de
 * nuevo -- Supabase revalida el ban al refrescar el token, así que también
 * corta una sesión ya abierta, no solo logins futuros. No hay vía para
 * reactivar todavía (no se pidió); si hace falta, es levantar el ban con
 * `ban_duration: "none"` + `activo = true`. */
export async function deactivateMember(targetProfileId: string): Promise<AuthResult> {
  const caller = await requireRole("admin");
  if (targetProfileId === caller.id) {
    return { error: "No podés eliminar tu propio usuario." };
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
  const caller = await requireRole("admin");

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
