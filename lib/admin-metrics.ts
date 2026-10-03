import type { Rol } from "@/lib/auth/types";
import type { TicketStatus } from "@/lib/types";

/** Cálculo de las métricas del panel de plataforma (`/admin`) -- puro, sin
 * Supabase (mismo patrón que `lib/dashboard.ts`/`lib/clientes-inteligencia.ts`):
 * la página trae los arrays crudos vía `lib/db/admin.ts` (service role, todas
 * las organizaciones) y este módulo deriva lo que se muestra. Las fechas se
 * reciben como ISO string y se comparan con `hoy` inyectado por parámetro
 * (nunca `new Date()` adentro) para que el test sea determinístico -- mismo
 * criterio que `lib/clientes-inteligencia.ts`, y mismo cuidado de huso
 * horario que `lib/dashboard.ts` para `esDelMes` (slices del string, no
 * `new Date(...).getMonth()`). */

export type AdminOrgRow = {
  id: string;
  nombre: string;
  plan: string;
  /** timestamptz de `organizations.created_at`, ISO string. */
  creadaEl: string;
};

export type AdminPerfilRow = {
  id: string;
  organizationId: string;
  rol: Rol;
  nombre: string;
  email: string;
  activo: boolean;
};

export type AdminVentaRow = {
  organizationId: string;
  /** timestamptz de `ventas.fecha`, ISO string. */
  fecha: string;
  totalUsd: number;
};

export type AdminTicketRow = {
  organizationId: string;
  estado: TicketStatus;
};

export type AdminClienteRow = {
  organizationId: string;
};

/** `last_sign_in_at` de auth.users (vía `service.auth.admin.listUsers()`) --
 * un usuario que nunca entró queda en null. */
export type AdminLoginRow = {
  userId: string;
  ultimoLogin: string | null;
};

export type OrgAdminMetricas = {
  orgId: string;
  nombre: string;
  plan: string;
  creadaEl: string;
  usuarios: number;
  usuariosActivos30d: number;
  ultimoLogin: string | null;
  ventasMes: number;
  facturacionMesUsd: number;
  ticketsAbiertos: number;
  clientesTotal: number;
};

export type UsuarioAdmin = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  ultimoLogin: string | null;
};

/** Ventana de "usuario activo": entró alguna vez en los últimos 30 días. */
export const DIAS_ACTIVO_PLATAFORMA = 30;

const MS_30_DIAS = DIAS_ACTIVO_PLATAFORMA * 24 * 60 * 60 * 1000;

function esDelMes(fecha: string, anio: number, mes0: number): boolean {
  return (
    fecha.slice(0, 4) === String(anio) && Number(fecha.slice(5, 7)) - 1 === mes0
  );
}

function activoEn30d(ultimoLogin: string, hoy: Date): boolean {
  return hoy.getTime() - new Date(ultimoLogin).getTime() <= MS_30_DIAS;
}

/** Métricas por organización para la overview de `/admin`, ordenadas por
 * facturación del mes (las más activas primero) y a equaldad por nombre. */
export function metricasPorOrganizacion(
  params: {
    orgs: AdminOrgRow[];
    perfiles: AdminPerfilRow[];
    ventas: AdminVentaRow[];
    tickets: AdminTicketRow[];
    clientes: AdminClienteRow[];
    logins: AdminLoginRow[];
    hoy?: Date;
  },
): OrgAdminMetricas[] {
  const hoy = params.hoy ?? new Date();
  const anio = hoy.getFullYear();
  const mes0 = hoy.getMonth();

  const loginPorUsuario = new Map(
    params.logins.map((l) => [l.userId, l.ultimoLogin]),
  );

  return params.orgs
    .map((org) => {
      const perfilesOrg = params.perfiles.filter(
        (p) => p.organizationId === org.id,
      );
      const logins = perfilesOrg
        .map((p) => loginPorUsuario.get(p.id) ?? null)
        .filter((l): l is string => !!l);
      // ISO strings del mismo formato comparan bien lexicográficamente.
      const ultimoLogin = logins.length
        ? logins.reduce((a, b) => (a > b ? a : b))
        : null;
      const ventasMes = params.ventas.filter(
        (v) => v.organizationId === org.id && esDelMes(v.fecha, anio, mes0),
      );

      return {
        orgId: org.id,
        nombre: org.nombre,
        plan: org.plan,
        creadaEl: org.creadaEl,
        usuarios: perfilesOrg.length,
        usuariosActivos30d: logins.filter((l) => activoEn30d(l, hoy)).length,
        ultimoLogin,
        ventasMes: ventasMes.length,
        facturacionMesUsd: ventasMes.reduce((a, v) => a + v.totalUsd, 0),
        ticketsAbiertos: params.tickets.filter(
          (t) => t.organizationId === org.id && t.estado !== "entregado",
        ).length,
        clientesTotal: params.clientes.filter(
          (c) => c.organizationId === org.id,
        ).length,
      };
    })
    .sort(
      (a, b) =>
        b.facturacionMesUsd - a.facturacionMesUsd ||
        a.nombre.localeCompare(b.nombre),
    );
}

/** Usuarios de una organización para el detalle de `/admin` -- la fila de la
 * tabla con su `last_sign_in_at` resuelto. */
export function usuariosDetalle(
  perfiles: AdminPerfilRow[],
  logins: AdminLoginRow[],
): UsuarioAdmin[] {
  const loginPorUsuario = new Map(
    logins.map((l) => [l.userId, l.ultimoLogin]),
  );
  return perfiles
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      email: p.email,
      rol: p.rol,
      activo: p.activo,
      ultimoLogin: loginPorUsuario.get(p.id) ?? null,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}
