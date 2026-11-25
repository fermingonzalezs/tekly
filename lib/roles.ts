import type { Rol } from "@/lib/auth/types";

/** Los 3 roles, en el orden en que se muestran y se guardan. */
export const ROLES: readonly Rol[] = ["admin", "vendedor", "tecnico"];

/** Etiqueta corta de un rol (para chips y para `etiquetaRoles`). El panel de
 * plataforma sigue usando `rolLabel` de `lib/status.ts` ("Admin / Dueño"). */
export const ROL_ETIQUETA: Record<Rol, string> = {
  admin: "Admin",
  vendedor: "Vendedor",
  tecnico: "Técnico",
};

/** ¿El usuario tiene **alguno** de los roles pedidos? Sin argumentos, true.
 *
 * Los permisos de un usuario con varios roles son la unión: un
 * Vendedor + Técnico ve todo lo que ve un técnico y todo lo que ve un
 * vendedor (`tieneRol(user, "admin", "tecnico")` es true). */
export function tieneRol(
  user: { roles: readonly Rol[] },
  ...roles: Rol[]
): boolean {
  if (roles.length === 0) return true;
  // Admin incluye todo (plan 029, decisión 3).
  if (user.roles.includes("admin")) return true;
  return roles.some((r) => user.roles.includes(r));
}

/** Roles válidos, sin duplicados, en orden fijo y con `admin` absorbiendo al
 * resto. Devuelve `[]` si no queda ninguno válido (el caller decide el
 * error); nunca inventa un rol. */
export function normalizarRoles(roles: readonly string[] | null | undefined): Rol[] {
  const validos = new Set(
    (roles ?? []).filter((r): r is Rol => (ROLES as readonly string[]).includes(r)),
  );
  if (validos.has("admin")) return ["admin"];
  return ROLES.filter((r) => r !== "admin" && validos.has(r));
}

/** Rol principal derivado: admin > técnico > vendedor. Es el que se guarda
 * en `profiles.rol` (trigger) y el único que miran las policies existentes. */
export function rolPrincipal(roles: readonly Rol[]): Rol {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("tecnico")) return "tecnico";
  return "vendedor";
}

/** "Vendedor y técnico", "Admin", "Vendedor" — para mostrar en un chip o en
 * el menú de cuenta. */
export function etiquetaRoles(roles: readonly Rol[]): string {
  const orden = normalizarRoles(roles);
  if (orden.length === 0) return "Sin rol";
  const [primero, ...resto] = orden.map((r) => ROL_ETIQUETA[r]);
  return [
    primero,
    ...resto.map((l) => l.charAt(0).toLowerCase() + l.slice(1)),
  ].join(" y ");
}

/** ¿Los dos conjuntos de roles son el mismo? (para saber si hay cambios que
 * guardar al editar un usuario, sin depender del orden). */
export function mismosRoles(a: readonly Rol[], b: readonly Rol[]): boolean {
  const na = normalizarRoles(a);
  const nb = normalizarRoles(b);
  return na.length === nb.length && na.every((r, i) => r === nb[i]);
}
