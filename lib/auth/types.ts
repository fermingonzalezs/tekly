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
