import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ChartTitle } from "@/components/ui/chart-title";
import { listOrganizacionesRaw } from "@/lib/db/admin";
import { metricasPorOrganizacion } from "@/lib/admin-metrics";
import { fmtDayMonth, fmtMonthYear, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { thDivider } from "@/lib/ui-styles";

/** Overview de `/admin`: KPIs globales + una tabla con todas las
 * organizaciones (nombre, antigüedad, usuarios, actividad de login y
 * volumen de negocio del mes). Todo server-side -- las filas linkean al
 * detalle, no hay interacción que justifique un client component. */
export default async function AdminOverviewPage() {
  const raw = await listOrganizacionesRaw();
  const metricas = metricasPorOrganizacion({ ...raw, hoy: new Date() });

  const usuariosTotal = raw.perfiles.length;
  const activos30d = metricas.reduce((a, m) => a + m.usuariosActivos30d, 0);
  const ventasMes = metricas.reduce((a, m) => a + m.ventasMes, 0);
  const facturacionMes = metricas.reduce((a, m) => a + m.facturacionMesUsd, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Organizaciones" value={metricas.length} hint="en total" />
        <StatCard label="Usuarios" value={usuariosTotal} hint="en todas las orgs" />
        <StatCard
          label="Activos (30 días)"
          value={activos30d}
          hint="entraron en 30 días"
        />
        <StatCard
          label="Ventas del mes"
          value={fmtUsd(facturacionMes)}
          hint={`${ventasMes} ventas · todas las orgs`}
        />
      </div>

      <div>
        <ChartTitle align="left" divider sub={`${metricas.length} organizaciones`}>
          Organizaciones
        </ChartTitle>
        <Card className="mt-3 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs">
                  <th className={cn("px-5 py-3", thDivider)}>Organización</th>
                  <th className={cn("px-5 py-3", thDivider)}>Creada</th>
                  <th className={cn("px-5 py-3 text-end", thDivider)}>Usuarios</th>
                  <th className={cn("px-5 py-3 text-end", thDivider)}>
                    Activos 30d
                  </th>
                  <th className={cn("px-5 py-3", thDivider)}>Último login</th>
                  <th className={cn("px-5 py-3 text-end", thDivider)}>
                    Tickets abiertos
                  </th>
                  <th className={cn("px-5 py-3 text-end", thDivider)}>
                    Ventas del mes
                  </th>
                  <th className="px-5 py-3 text-end">Facturación</th>
                </tr>
              </thead>
              <tbody>
                {metricas.map((m) => (
                  <tr
                    key={m.orgId}
                    className="border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
                  >
                    <td className="px-5 py-2.5">
                      <Link
                        href={`/admin/organizaciones/${m.orgId}`}
                        className="font-medium text-neutral-900 hover:text-accent"
                      >
                        {m.nombre}
                      </Link>
                      <p className="text-xs text-neutral-500">{m.plan}</p>
                    </td>
                    <td className="px-5 py-2.5 text-neutral-500">
                      {fmtMonthYear(m.creadaEl)}
                    </td>
                    <td className="px-5 py-2.5 text-end tabular-nums">
                      {m.usuarios}
                    </td>
                    <td className="px-5 py-2.5 text-end tabular-nums">
                      {m.usuariosActivos30d}
                    </td>
                    <td className="px-5 py-2.5 text-neutral-500">
                      {m.ultimoLogin ? fmtDayMonth(m.ultimoLogin) : "—"}
                    </td>
                    <td className="px-5 py-2.5 text-end tabular-nums">
                      {m.ticketsAbiertos}
                    </td>
                    <td className="px-5 py-2.5 text-end tabular-nums">
                      {m.ventasMes}
                    </td>
                    <td className="px-5 py-2.5 text-end font-semibold tabular-nums">
                      {fmtUsd(m.facturacionMesUsd)}
                    </td>
                  </tr>
                ))}
                {metricas.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-10 text-center text-sm text-neutral-400"
                    >
                      Sin organizaciones todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
