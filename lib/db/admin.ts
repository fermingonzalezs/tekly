import "server-only";
import { createServiceRoleClient } from "@/lib/auth/supabase";
import type { Rol } from "@/lib/auth/types";
import { esPlanEstado, esPlanId, type PlanEstado, type PlanId, type Suscripcion } from "@/lib/planes";
import type {
  AdminClienteRow,
  AdminLoginRow,
  AdminOrgRow,
  AdminPerfilRow,
  AdminTicketRow,
  AdminVentaRow,
} from "@/lib/admin-metrics";

/** Datos del panel de plataforma (`/admin`) -- el único `lib/db/*` que corre
 * con `createServiceRoleClient()` para TODO: RLS está diseñado para aislar
 * por `organization_id`, no para un rol transversal, así que leer todas las
 * organizaciones a la vez solo se puede bypassando RLS. El gate de
 * autorización vive en quien llama (el layout de `/admin` y cada server
 * action corren `requirePlatformAdmin()` primero) -- NUNCA adentro de este
 * módulo, mismo criterio que `signUp`/`inviteMember`/`updateNegocio`. No hay
 * ninguna migración de por medio: son las tablas de siempre, leídas sin el
 * filtro de organización que impone RLS. */

type OrgDbRow = {
  id: string;
  nombre: string;
  plan: string;
  created_at: string;
};

type PerfilDbRow = {
  id: string;
  organization_id: string;
  rol: Rol;
  nombre: string;
  email: string;
  activo: boolean;
};

function toOrg(row: OrgDbRow): AdminOrgRow {
  return {
    id: row.id,
    nombre: row.nombre,
    plan: row.plan,
    creadaEl: row.created_at,
  };
}

function toPerfil(row: PerfilDbRow): AdminPerfilRow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    rol: row.rol,
    nombre: row.nombre,
    email: row.email,
    activo: row.activo,
  };
}

/** `last_sign_in_at` de todos los usuarios de auth.users -- el admin API
 * pagina (no hay "traer todos" de una), así que loop hasta agotar páginas.
 * No se puede acotar por organización: auth.users no conoce `organizations`.
 */
async function listLogins(): Promise<AdminLoginRow[]> {
  const service = createServiceRoleClient();
  const perPage = 500;
  const logins: AdminLoginRow[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    for (const u of data.users) {
      logins.push({ userId: u.id, ultimoLogin: u.last_sign_in_at ?? null });
    }
    if (data.users.length < perPage) break;
    page++;
  }
  return logins;
}

export type OrganizacionesRaw = {
  orgs: AdminOrgRow[];
  perfiles: AdminPerfilRow[];
  ventas: AdminVentaRow[];
  tickets: AdminTicketRow[];
  clientes: AdminClienteRow[];
  logins: AdminLoginRow[];
};

/** Todo el dataset del panel en una pasada: organizaciones + perfiles +
 * volumen de negocio (ventas/tickets/clientes) de TODAS las
 * organizaciones + `last_sign_in_at` de todos los usuarios. Los conteos no
 * se agregan en SQL a propósito: `lib/admin-metrics.ts` (puro, con test)
 * los deriva, igual que `lib/dashboard.ts` deriva los del dashboard. */
export async function listOrganizacionesRaw(): Promise<OrganizacionesRaw> {
  const service = createServiceRoleClient();
  const [orgsRes, perfilesRes, ventasRes, ticketsRes, clientesRes, logins] =
    await Promise.all([
      service
        .from("organizations")
        .select("id, nombre, plan, created_at")
        .order("created_at", { ascending: false })
        .returns<OrgDbRow[]>(),
      service
        .from("profiles")
        .select("id, organization_id, rol, nombre, email, activo")
        .order("nombre")
        .returns<PerfilDbRow[]>(),
      service
        .from("ventas")
        .select("organization_id, fecha, total_usd")
        .returns<
          { organization_id: string; fecha: string; total_usd: number }[]
        >(),
      service
        .from("tickets")
        .select("organization_id, estado")
        .returns<{ organization_id: string; estado: AdminTicketRow["estado"] }[]>(),
      service
        .from("clientes")
        .select("organization_id")
        .returns<{ organization_id: string }[]>(),
      listLogins(),
    ]);
  if (orgsRes.error) throw orgsRes.error;
  if (perfilesRes.error) throw perfilesRes.error;
  if (ventasRes.error) throw ventasRes.error;
  if (ticketsRes.error) throw ticketsRes.error;
  if (clientesRes.error) throw clientesRes.error;

  return {
    orgs: orgsRes.data.map(toOrg),
    perfiles: perfilesRes.data.map(toPerfil),
    ventas: ventasRes.data.map((v) => ({
      organizationId: v.organization_id,
      fecha: v.fecha,
      totalUsd: v.total_usd,
    })),
    tickets: ticketsRes.data.map((t) => ({
      organizationId: t.organization_id,
      estado: t.estado,
    })),
    clientes: clientesRes.data.map((c) => ({
      organizationId: c.organization_id,
    })),
    logins,
  };
}

/** Mismo dataset que `listOrganizacionesRaw` pero acotado a una
 * organización, para la página de detalle. `null` = no existe la org. */
export async function getOrganizacionDetalle(
  orgId: string,
): Promise<(OrganizacionesRaw & { org: AdminOrgRow }) | null> {
  const service = createServiceRoleClient();
  const [orgRes, perfilesRes, ventasRes, ticketsRes, clientesRes, logins] =
    await Promise.all([
      service
        .from("organizations")
        .select("id, nombre, plan, created_at")
        .eq("id", orgId)
        .maybeSingle<OrgDbRow>(),
      service
        .from("profiles")
        .select("id, organization_id, rol, nombre, email, activo")
        .eq("organization_id", orgId)
        .order("nombre")
        .returns<PerfilDbRow[]>(),
      service
        .from("ventas")
        .select("organization_id, fecha, total_usd")
        .eq("organization_id", orgId)
        .returns<
          { organization_id: string; fecha: string; total_usd: number }[]
        >(),
      service
        .from("tickets")
        .select("organization_id, estado")
        .eq("organization_id", orgId)
        .returns<{ organization_id: string; estado: AdminTicketRow["estado"] }[]>(),
      service
        .from("clientes")
        .select("organization_id")
        .eq("organization_id", orgId)
        .returns<{ organization_id: string }[]>(),
      listLogins(),
    ]);
  if (orgRes.error) throw orgRes.error;
  if (!orgRes.data) return null;
  if (perfilesRes.error) throw perfilesRes.error;
  if (ventasRes.error) throw ventasRes.error;
  if (ticketsRes.error) throw ticketsRes.error;
  if (clientesRes.error) throw clientesRes.error;

  return {
    org: toOrg(orgRes.data),
    orgs: [toOrg(orgRes.data)],
    perfiles: perfilesRes.data.map(toPerfil),
    ventas: ventasRes.data.map((v) => ({
      organizationId: v.organization_id,
      fecha: v.fecha,
      totalUsd: v.total_usd,
    })),
    tickets: ticketsRes.data.map((t) => ({
      organizationId: t.organization_id,
      estado: t.estado,
    })),
    clientes: clientesRes.data.map((c) => ({
      organizationId: c.organization_id,
    })),
    logins,
  };
}

/** Cambia el rol de cualquier usuario de cualquier organización -- la
 * versión cross-org de `setMemberRole` (`lib/auth/index.ts`), pero sin el
 * chequeo de "misma organización que quien llama" ni la RPC: el admin API
 * de perfiles no tiene una RPC cross-org, así que va directo por service
 * role. El gate (`requirePlatformAdmin`) corre en la action, no acá. */
export async function setUserRolePlatform(
  targetProfileId: string,
  nuevoRol: Rol,
): Promise<void> {
  const service = createServiceRoleClient();
  const { error } = await service
    .from("profiles")
    .update({ rol: nuevoRol })
    .eq("id", targetProfileId);
  if (error) throw error;
}

/** Activa/desactiva cualquier usuario de cualquier organización -- la
 * versión cross-org de `deactivateMember`: baja lógica en `profiles.activo`
 * + ban en Supabase Auth (`ban_duration`, revalidado al refrescar el
 * token, corta también sesiones ya abiertas). Reactivar es levantar el ban
 * (`ban_duration: "none"`) + `activo = true`. */
export async function setUserActivoPlatform(
  targetProfileId: string,
  activo: boolean,
): Promise<void> {
  const service = createServiceRoleClient();
  const { error: banError } = await service.auth.admin.updateUserById(
    targetProfileId,
    { ban_duration: activo ? "none" : "876000h" },
  );
  if (banError) throw banError;

  const { error: profileError } = await service
    .from("profiles")
    .update({ activo })
    .eq("id", targetProfileId);
  if (profileError) throw profileError;
}

/** Plan y estado de una organización (para el editor de `/admin`). */
export async function getSuscripcionPlatform(orgId: string): Promise<Suscripcion | null> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("organizations")
    .select("plan, plan_estado, trial_termina_at, periodo_termina_at")
    .eq("id", orgId)
    .maybeSingle<{
      plan: string;
      plan_estado: string;
      trial_termina_at: string | null;
      periodo_termina_at: string | null;
    }>();
  if (error) throw error;
  if (!data) return null;
  return {
    plan: esPlanId(data.plan) ? data.plan : "trial",
    estado: esPlanEstado(data.plan_estado) ? data.plan_estado : "trial",
    trialTerminaAt: data.trial_termina_at,
    periodoTerminaAt: data.periodo_termina_at,
  };
}

/** Asigna plan/estado/vencimientos a una organización (cobro manual por
 * transferencia hasta que haya proveedor de pagos). Sin gate propio: ver el
 * comentario de arriba, lo corre `requirePlatformAdmin()` en la action. */
export async function setPlanPlatform(
  orgId: string,
  data: {
    plan: PlanId;
    estado: PlanEstado;
    trialTerminaAt: string | null;
    periodoTerminaAt: string | null;
  },
): Promise<void> {
  const service = createServiceRoleClient();
  const { error } = await service
    .from("organizations")
    .update({
      plan: data.plan,
      plan_estado: data.estado,
      trial_termina_at: data.trialTerminaAt,
      periodo_termina_at: data.periodoTerminaAt,
    })
    .eq("id", orgId);
  if (error) throw error;
}

/** Elimina una organización completa: usuarios de auth, todos sus datos
 * (las FK `organization_id` son `on delete cascade`) y su logo del bucket.
 * Irreversible. Los usuarios de auth van PRIMERO: si uno falla, la
 * organización sigue existiendo y se puede reintentar; al revés quedarían
 * cuentas de auth huérfanas que bloquean volver a registrar ese email. */
export async function deleteOrganizacionPlatform(orgId: string): Promise<void> {
  const service = createServiceRoleClient();

  const { data: perfiles, error: perfilesError } = await service
    .from("profiles")
    .select("id")
    .eq("organization_id", orgId)
    .returns<{ id: string }[]>();
  if (perfilesError) throw perfilesError;

  for (const p of perfiles) {
    const { error } = await service.auth.admin.deleteUser(p.id);
    if (error) throw error;
  }

  const { error: orgError } = await service.from("organizations").delete().eq("id", orgId);
  if (orgError) throw orgError;

  // Best-effort: un logo huérfano no rompe nada.
  const { data: archivos } = await service.storage.from("logos").list(orgId);
  if (archivos?.length) {
    await service.storage.from("logos").remove(archivos.map((a) => `${orgId}/${a.name}`));
  }
}
