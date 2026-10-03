import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth";
import { getOrganizacionDetalle } from "@/lib/db/admin";
import { metricasPorOrganizacion, usuariosDetalle } from "@/lib/admin-metrics";
import { fmtDayMonth, fmtMonthYear } from "@/lib/format";
import { OrganizacionClient } from "./organizacion-client";

/** Detalle de una organización en el panel de plataforma: métricas del mes +
 * tabla de usuarios con cambio de rol y activar/desactivar. Las fechas se
 * formatean acá (server) y viajan al client component como labels -- un
 * `new Date(iso)` dentro del client renderizaría distinto en server/client
 * si los husos horarios difieren (hydration mismatch). */
export default async function OrganizacionPage({
  params,
}: {
  params: { id: string };
}) {
  const [session, detalle] = await Promise.all([
    requirePlatformAdmin(),
    getOrganizacionDetalle(params.id),
  ]);
  if (!detalle) notFound();

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

  return (
    <OrganizacionClient
      org={{
        nombre: org.nombre,
        plan: org.plan,
        creadaLabel: fmtMonthYear(org.creadaEl),
        ultimoLoginLabel: metricas.ultimoLogin
          ? fmtDayMonth(metricas.ultimoLogin)
          : "—",
      }}
      metricas={metricas}
      usuarios={usuarios}
      currentUserId={session.id}
    />
  );
}
