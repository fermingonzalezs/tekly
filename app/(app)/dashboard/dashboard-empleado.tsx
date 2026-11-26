"use client";

import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { KpisAdmin } from "@/components/dashboard/kpis-admin";
import { AgendaLocalCard } from "@/components/dashboard/agenda-local";
import { RitmoChart } from "@/components/dashboard/ritmo-chart";
import { RubrosPie } from "@/components/dashboard/rubros-pie";
import { VentasRecientesTabla } from "@/components/dashboard/ventas-recientes-tabla";
import { MisTickets } from "@/components/dashboard/mis-tickets";
import { useRefrescoEnVivo } from "@/components/dashboard/use-refresco-en-vivo";
import {
  etiquetaMes,
  type AgendaLocal,
  type MesDashboard,
  type MetricaDashboard,
  type RitmoMes,
  type TicketTecnico,
  type VentaReciente,
} from "@/lib/dashboard";
import type { Rol } from "@/lib/auth/types";

/** Datos del bloque de ventas propias (solo vendedor). Nada de ganancia,
 * margen, costo ni la meta de la org: el server ya los dejó afuera. */
export type MisVentasDashboard = {
  ritmo: RitmoMes;
  rubros: { label: string; value: number }[];
  totalMes: number;
  recientes: VentaReciente[];
};

/** Dashboard de empleado (vendedor y/o técnico) con el mismo lenguaje que el
 * de admin: KPIs → agenda del local → (vendedor) su ritmo del mes + sus
 * ventas por rubro + sus ventas recientes → (técnico) sus tickets. El server
 * ya filtró todo por rol (ver `page.tsx` y el plan 005): de un empleado no
 * llega ninguna ganancia/margen/costo ni el objetivo de la org, así que el
 * ritmo va sin línea de meta. Con los dos roles (plan 029) se muestran ambos
 * bloques. */
export function DashboardEmpleado({
  roles,
  metrics,
  mes,
  agenda,
  misVentas,
  misTickets,
}: {
  /** Roles del empleado, sin admin (plan 029). */
  roles: Rol[];
  metrics: MetricaDashboard[];
  mes: MesDashboard;
  agenda: AgendaLocal;
  /** Solo vendedor. */
  misVentas?: MisVentasDashboard;
  /** Solo técnico: sus tickets abiertos. */
  misTickets?: TicketTecnico[];
}) {
  useRefrescoEnVivo();
  const esTecnico = roles.includes("tecnico");

  return (
    <Section title="Dashboard" ayuda="dashboard">
      <div className="mx-auto max-w-[1400px] space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-lg font-semibold text-neutral-900">
            Tu resumen de {etiquetaMes(mes.anio, mes.mes0).toLowerCase()}
          </h1>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#12a383]" aria-hidden="true" />
            actualizado en vivo
          </span>
        </div>

        <KpisAdmin metrics={metrics} />

        <AgendaLocalCard agenda={agenda} />

        {misVentas && (
          <>
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <RitmoChart
                className="min-h-[340px] min-w-0"
                ritmo={misVentas.ritmo}
                target={0}
                title="Mi ritmo del mes"
              />
              <Card className="flex min-w-0 flex-col p-5">
                <RubrosPie data={misVentas.rubros} totalFacturado={misVentas.totalMes} />
              </Card>
            </div>
            <VentasRecientesTabla sales={misVentas.recientes} />
          </>
        )}

        {esTecnico && <MisTickets className="min-h-[260px]" tickets={misTickets ?? []} />}
      </div>
    </Section>
  );
}
