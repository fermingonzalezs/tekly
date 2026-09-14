import "server-only";
import { redirect } from "next/navigation";
import {
  createServerClient,
  createServiceRoleClient,
} from "@/lib/auth/supabase";
import type { AuthResult, Rol, SessionUser } from "@/lib/auth/types";

export type { Rol, SessionUser, AuthResult } from "@/lib/auth/types";

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
): Promise<AuthResult> {
  const supabase = createServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  const supabase = createServerClient();
  await supabase.auth.signOut();
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
}): Promise<AuthResult> {
  const supabase = createServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
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

  return { error: null };
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
