"use client";

import { useState } from "react";
import { Section } from "@/components/section";
import { Tabs } from "@/components/ui/tabs";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { RecentSales } from "@/components/dashboard/recent-sales";
import { TurnosHeatmap } from "@/components/dashboard/turnos-heatmap";
import { MisTickets } from "@/components/dashboard/mis-tickets";
import { useRefrescoEnVivo } from "@/components/dashboard/use-refresco-en-vivo";
import { DASH_PERIODOS, type DashPeriodo } from "@/lib/mock-data";
import type {
  MetricaDashboard,
  TicketTecnico,
  VentaReciente,
} from "@/lib/dashboard";
import type { Rol } from "@/lib/auth/types";
import type { Turno } from "@/lib/types";

/** Dashboard de empleado (vendedor / técnico). El server ya filtró todo por
 * rol: de un vendedor no llega ninguna ganancia/margen/costo ni el objetivo
 * de la org (ver `page.tsx` y el plan 005) -- el cliente solo arma el
 * layout. Vendedor: sus ventas (tendencia sin línea de ganancia) + ventas
 * recientes propias. Técnico: "Mis tickets" en vez de tendencia/ventas. */
export function DashboardEmpleado({
  rol,
  metrics,
  trendByPeriodo,
  rubroMix,
  recentSales,
  misTickets,
  turnos,
}: {
  rol: Rol;
  metrics: MetricaDashboard[];
  /** Solo vendedor: su propia serie (sin `ganancia`). */
  trendByPeriodo?: Record<DashPeriodo, { venta: number[]; fechas: string[] }>;
  rubroMix?: Record<DashPeriodo, { label: string; value: number }[]>;
  /** Solo vendedor: sus últimas ventas. */
  recentSales?: VentaReciente[];
  /** Solo técnico: sus tickets abiertos. */
  misTickets?: TicketTecnico[];
  turnos: Turno[];
}) {
  useRefrescoEnVivo();
  const esVendedor = rol === "vendedor";
  const [periodo, setPeriodo] = useState<DashPeriodo>("mes");
  const meta = DASH_PERIODOS.find((p) => p.value === periodo)!;
  const trend = trendByPeriodo?.[periodo];

  return (
    <Section
      title="Dashboard"
      ayuda="dashboard"
      toolbar={
        esVendedor ? (
          <div className="no-scrollbar flex flex-1 justify-center overflow-x-auto sm:flex-none sm:justify-start">
            <Tabs
              value={periodo}
              onChange={setPeriodo}
              options={DASH_PERIODOS.map((p) => ({
                value: p.value,
                label: p.label,
              }))}
              className="flex-nowrap gap-1.5 sm:gap-2"
            />
          </div>
        ) : undefined
      }
      mainClassName="flex flex-col gap-4 p-4 pb-10 md:p-6"
    >
      <MetricCards metrics={metrics} />

      <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {esVendedor ? (
          <div className="flex min-w-0 flex-col gap-3">
            {trend && (
              <TrendChart
                className="min-h-[240px] flex-1"
                venta={trend.venta}
                fechas={trend.fechas}
                rubroMix={rubroMix?.[periodo] ?? []}
                sub={meta.trendSub}
              />
            )}
            {recentSales && <RecentSales className="shrink-0" sales={recentSales} />}
          </div>
        ) : (
          <MisTickets className="min-h-[300px]" tickets={misTickets ?? []} />
        )}

        <div className="flex min-w-0 flex-col gap-3">
          <TurnosHeatmap className="shrink-0" turnos={turnos} />
        </div>
      </div>
    </Section>
  );
}
