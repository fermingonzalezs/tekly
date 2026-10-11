import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth";
import { getOrganizacionDetalle, getSuscripcionPlatform } from "@/lib/db/admin";
import { PLANES } from "@/lib/planes";
import { metricasPorOrganizacion, usuariosDetalle } from "@/lib/admin-metrics";
import { fmtDayMonth, fmtMonthYear } from "@/lib/format";
import { OrganizacionClient } from "./organizacion-client";
import { PlanOrgCard } from "./plan-org-card";
import { EliminarOrgCard } from "./eliminar-org-card";

/** Detalle de una organización en el panel de plataforma: métricas del mes +
 * tabla de usuarios con cambio de rol y activar/desactivar. Las fechas se
 * formatean acá (server) y viajan al client component como labels -- un
 * `new Date(iso)` dentro del client renderizaría distinto en server/client
 * si los husos horarios difieren (hydration mismatch). */
export default async function OrganizacionPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const [session, detalle, suscripcion] = await Promise.all([
    requirePlatformAdmin(),
    getOrganizacionDetalle(params.id),
    getSuscripcionPlatform(params.id),
  ]);
  if (!detalle || !suscripcion) notFound();

  const { org, orgs, perfiles, ventas, tickets, clientes, logins } = detalle;
  const [metricas] = metricasPorOrganizacion({
    orgs,
    perfiles,
    ventas,
    tickets,
    clientes,
    logins,
    hoy: new Date(),
  });
  const usuarios = usuariosDetalle(perfiles, logins).map((u) => ({
    ...u,
    ultimoLoginLabel: u.ultimoLogin ? fmtDayMonth(u.ultimoLogin) : "—",
  }));

  const usuariosActivos = perfiles.filter((p) => p.activo).length;

  return (
    <div className="space-y-6">
    <OrganizacionClient
      org={{
        nombre: org.nombre,
        plan: PLANES[suscripcion.plan].label,
        creadaLabel: fmtMonthYear(org.creadaEl),
        ultimoLoginLabel: metricas.ultimoLogin
          ? fmtDayMonth(metricas.ultimoLogin)
          : "—",
      }}
      metricas={metricas}
      usuarios={usuarios}
      currentUserId={session.id}
    />
    <PlanOrgCard
      orgId={params.id}
      suscripcion={suscripcion}
      usuariosActivos={usuariosActivos}
    />
    <EliminarOrgCard
      orgId={params.id}
      nombre={org.nombre}
      esPropia={params.id === session.organizationId}
      usuarios={perfiles.length}
    />
    </div>
  );
}
