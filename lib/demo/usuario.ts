/**
 * Usuario fijo de la demo (plan 014): rol admin para que se vean costo/margen
 * y el dashboard completo. Sin importar `@/lib/auth` (el guard de
 * aislamiento de `lib/demo/` lo prohíbe) -- el tipo local es estructuralmente
 * compatible con `SessionUser`.
 */
type UsuarioDemo = {
  id: string;
  email: string;
  organizationId: string;
  organizationNombre: string;
  rol: "admin";
  nombre: string;
  alias: string | null;
  terminosVersion: string | null;
};

export const USUARIO_DEMO: UsuarioDemo = {
  id: "demo-user",
  email: "demo@tekly.tech",
  organizationId: "demo",
  organizationNombre: "Tekly Demo",
  rol: "admin",
  nombre: "Visitante demo",
  alias: null,
  terminosVersion: null,
};
