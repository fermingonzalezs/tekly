import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ChartTitle } from "@/components/ui/chart-title";
import { listReportesBugs } from "@/lib/db/admin";
import { rolLabel } from "@/lib/status";
import { cn } from "@/lib/utils";
import { thDivider } from "@/lib/ui-styles";
import type { Rol } from "@/lib/auth/types";
import { dotClass } from "@/lib/status";
import { ResolverReporte } from "./resolver-reporte";

const fechaHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** La ruta se guarda como el `referer` completo: se muestra solo el path. */
function seccionDe(ruta: string | null): string {
  if (!ruta) return "—";
  try {
    const url = new URL(ruta);
    return url.pathname + url.search;
  } catch {
    return ruta;
  }
}

/** `/admin/reportes`: los reportes de «Reportar un problema» de todas las
 * organizaciones (los mismos que avisan por Telegram). El gate es el layout
 * de `/admin` (`requirePlatformAdmin`). */
export default async function AdminReportesPage() {
  const reportes = await listReportesBugs();
  const hace7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const ultimaSemana = reportes.filter((r) => new Date(r.createdAt).getTime() >= hace7).length;
  const sinResolver = reportes.filter((r) => r.estado === "abierto").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Sin resolver" value={sinResolver} hint="reportes abiertos" />
        <StatCard label="Últimos 7 días" value={ultimaSemana} hint="reportes nuevos" />
        <StatCard label="Reportes" value={reportes.length} hint="en total" />
      </div>

      <div>
        <ChartTitle align="left" divider sub="Lo que mandan los usuarios desde «Reportar un problema»">
          Problemas reportados
        </ChartTitle>
        <Card className="mt-3 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs">
                  <th className={cn("px-5 py-3", thDivider)}>Fecha</th>
                  <th className={cn("px-5 py-3", thDivider)}>Organización</th>
                  <th className={cn("px-5 py-3", thDivider)}>Usuario</th>
                  <th className={cn("px-5 py-3", thDivider)}>Sección</th>
                  <th className={cn("px-5 py-3", thDivider)}>Estaba haciendo</th>
                  <th className={cn("px-5 py-3", thDivider)}>Problema</th>
                  <th className={cn("px-5 py-3", thDivider)}>Estado</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {reportes.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-100 align-top first:border-t-0">
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums text-neutral-600">
                      {fechaHora.format(new Date(r.createdAt))}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/organizaciones/${r.organizationId}`}
                        className="font-medium text-neutral-900 hover:text-accent"
                      >
                        {r.organizacion}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-start">
                      <p className="font-medium text-neutral-900">{r.usuarioNombre}</p>
                      <p className="text-xs text-neutral-500">
                        {rolLabel[r.rol as Rol] ?? r.rol} · {r.usuarioEmail}
                      </p>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-neutral-600">
                      {seccionDe(r.ruta)}
                    </td>
                    <td className="min-w-[12rem] px-5 py-3 text-start text-neutral-700">
                      {r.accion || "—"}
                    </td>
                    <td className="min-w-[18rem] whitespace-pre-wrap px-5 py-3 text-start text-neutral-900">
                      {r.descripcion}
                      {r.respuesta && (
                        <p className="mt-2 border-l-2 border-emerald-400 pl-2 text-xs text-neutral-600">
                          <span className="font-semibold text-neutral-700">Respuesta: </span>
                          {r.respuesta}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            r.estado === "resuelto" ? dotClass.green : dotClass.amber,
                          )}
                        />
                        {r.estado === "resuelto" ? "Resuelto" : "Abierto"}
                      </span>
                      {r.estado === "resuelto" && (
                        <p className="mt-1 text-[11px] text-neutral-500">
                          {r.visto ? "El usuario lo vio" : "Sin ver todavía"}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <ResolverReporte
                        id={r.id}
                        descripcion={r.descripcion}
                        usuario={r.usuarioNombre}
                        resuelto={r.estado === "resuelto"}
                        respuesta={r.respuesta}
                      />
                    </td>
                  </tr>
                ))}
                {reportes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-neutral-500">
                      Todavía no hay reportes.
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
