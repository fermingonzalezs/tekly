"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { ChartTitle } from "@/components/ui/chart-title";
import { Select } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { dotClass, rolLabel } from "@/lib/status";
import { fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { thDivider } from "@/lib/ui-styles";
import { setUserActivoPlatformAction, setUserRolePlatformAction } from "./actions";
import type { Rol } from "@/lib/auth/types";
import type { OrgAdminMetricas, UsuarioAdmin } from "@/lib/admin-metrics";

const ROLES: Rol[] = ["admin", "vendedor", "tecnico"];

/** `ultimoLogin` pre-formateado server-side (ver el page.tsx) -- el raw ISO no
 * viaja al cliente para que no haya formatting con husos horarios distintos. */
export type UsuarioAdminRow = UsuarioAdmin & { ultimoLoginLabel: string };

export function OrganizacionClient({
  org,
  metricas,
  usuarios,
  currentUserId,
}: {
  org: {
    nombre: string;
    plan: string;
    creadaLabel: string;
    ultimoLoginLabel: string;
  };
  metricas: OrgAdminMetricas;
  usuarios: UsuarioAdminRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [rolesLocales, setRolesLocales] = useState<Record<string, Rol>>({});
  const [confirmDesactivar, setConfirmDesactivar] = useState<UsuarioAdminRow | null>(
    null,
  );
  const [rolPending, startRolTransition] = useTransition();
  const [estadoPending, startEstadoTransition] = useTransition();
  const pending = rolPending || estadoPending;

  function cambiarRol(user: UsuarioAdminRow, rol: Rol) {
    setError(null);
    setRolesLocales((r) => ({ ...r, [user.id]: rol }));
    startRolTransition(async () => {
      const result = await setUserRolePlatformAction(user.id, rol);
      if (result.error) {
        setError(result.error);
        setRolesLocales((r) => {
          const { [user.id]: _descartado, ...rest } = r;
          return rest;
        });
        return;
      }
      router.refresh();
    });
  }

  function desactivar() {
    if (!confirmDesactivar) return;
    const target = confirmDesactivar;
    setError(null);
    startEstadoTransition(async () => {
      const result = await setUserActivoPlatformAction(target.id, false);
      if (result.error) {
        setError(result.error);
        setConfirmDesactivar(null);
        return;
      }
      setConfirmDesactivar(null);
      router.refresh();
    });
  }

  function reactivar(user: UsuarioAdminRow) {
    setError(null);
    startEstadoTransition(async () => {
      const result = await setUserActivoPlatformAction(user.id, true);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-lg py-1 text-[13px] font-medium text-neutral-500 transition-colors hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <ArrowLeft className="h-4 w-4" />
          Panel
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-grotesk text-lg font-semibold text-neutral-900">
            {org.nombre}
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {org.plan}
          </span>
        </div>
        <p className="mt-1 text-[13px] text-neutral-500">
          Creada {org.creadaLabel} · Último login {org.ultimoLoginLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Usuarios" value={metricas.usuarios} hint="perfiles" />
        <StatCard
          label="Activos 30d"
          value={metricas.usuariosActivos30d}
          hint="entraron en 30 días"
        />
        <StatCard label="Clientes" value={metricas.clientesTotal} hint="registrados" />
        <StatCard
          label="Ventas del mes"
          value={metricas.ventasMes}
          hint={fmtUsd(metricas.facturacionMesUsd)}
        />
        <StatCard
          label="Facturación del mes"
          value={fmtUsd(metricas.facturacionMesUsd)}
          hint={`${metricas.ventasMes} ventas`}
        />
        <StatCard
          label="Tickets abiertos"
          value={metricas.ticketsAbiertos}
          hint="sin entregar"
        />
      </div>

      <div>
        <ChartTitle align="left" divider sub={`${usuarios.length} usuarios`}>
          Usuarios y roles
        </ChartTitle>
        <Card className="mt-3 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs">
                  <th className={cn("px-5 py-3", thDivider)}>Nombre</th>
                  <th className={cn("px-5 py-3", thDivider)}>Email</th>
                  <th className={cn("px-5 py-3", thDivider)}>Rol</th>
                  <th className={cn("px-5 py-3", thDivider)}>Último login</th>
                  <th className="px-5 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const esUnoMismo = u.id === currentUserId;
                  return (
                    <tr
                      key={u.id}
                      className="border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
                    >
                      <td className="px-5 py-2.5 font-medium">
                        {u.nombre}
                        {esUnoMismo && (
                          <span className="ml-1.5 text-xs text-neutral-500">(vos)</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-neutral-500">{u.email}</td>
                      <td className="px-5 py-2.5">
                        <Select
                          aria-label={`Rol de ${u.nombre}`}
                          disabled={pending || esUnoMismo}
                          value={rolesLocales[u.id] ?? u.rol}
                          onChange={(e) =>
                            cambiarRol(u, e.target.value as Rol)
                          }
                          className="h-8 w-40 text-[13px]"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {rolLabel[r]}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-5 py-2.5 text-neutral-500">
                        {u.ultimoLoginLabel}
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                u.activo ? dotClass.green : dotClass.gray,
                              )}
                            />
                            {u.activo ? "Activo" : "Inactivo"}
                          </span>
                          {esUnoMismo ? null : u.activo ? (
                            <Button
                              variant="danger-outline"
                              size="sm"
                              disabled={pending}
                              onClick={() => setConfirmDesactivar(u)}
                            >
                              Desactivar
                            </Button>
                          ) : (
                            <Button
                              variant="tonal"
                              size="sm"
                              disabled={pending}
                              onClick={() => reactivar(u)}
                            >
                              Reactivar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {usuarios.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-sm text-neutral-400"
                    >
                      Sin usuarios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <ConfirmDialog
        open={!!confirmDesactivar}
        onClose={() => setConfirmDesactivar(null)}
        onConfirm={desactivar}
        pending={estadoPending}
        title="¿Desactivar usuario?"
        confirmLabel="Desactivar"
      >
        Se desactivará a «{confirmDesactivar?.nombre}» -- pierde acceso a Tekly
        de inmediato (ban en Supabase Auth, corta también sesiones ya abiertas).
        Su historial (ventas, tickets, movimientos) se conserva, y se puede
        reactivar desde esta misma tabla.
      </ConfirmDialog>
    </div>
  );
}
