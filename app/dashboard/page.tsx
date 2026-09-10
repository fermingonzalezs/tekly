"use client";

import { useState } from "react";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { RubrosPie } from "@/components/dashboard/rubros-pie";
import { ObjetivoPanel } from "@/components/dashboard/objetivo-panel";
import { TurnosHeatmap } from "@/components/dashboard/turnos-heatmap";
import { RecentSales } from "@/components/dashboard/recent-sales";
import {
  DASH_PERIODOS,
  salesTrendByPeriod,
  ventasPorRubro,
  type DashPeriodo,
} from "@/lib/mock-data";

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState<DashPeriodo>("mes");
  const meta = DASH_PERIODOS.find((p) => p.value === periodo)!;
  const trend = salesTrendByPeriod[periodo];

  return (
    <Section
      title="Dashboard"
      toolbar={
        <Tabs
          value={periodo}
          onChange={setPeriodo}
          options={DASH_PERIODOS.map((p) => ({
            value: p.value,
            label: p.label,
          }))}
        />
      }
      // En pantallas xl el dashboard entra completo en el viewport: alto =
      // 100dvh menos TopNav (h-16) + Topbar (h-14), sin scroll de página.
      // Debajo de xl las columnas se apilan y se deja scrollear con normalidad.
      mainClassName="flex flex-col p-4 xl:h-[calc(100dvh-7.5rem)] xl:overflow-hidden"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <MetricCards />

        <div className="grid min-h-0 flex-1 items-stretch gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* Columna izquierda: tendencia (se estira) + rubros/objetivo */}
          <div className="flex min-h-0 min-w-0 flex-col gap-3">
            <TrendChart
              className="min-h-0 flex-1"
              venta={trend.venta}
              ganancia={trend.ganancia}
              sub={meta.trendSub}
            />
            <div className="grid shrink-0 gap-3 sm:grid-cols-2">
              <Card className="flex flex-col p-4">
                <RubrosPie data={ventasPorRubro[meta.rubroKey]} />
              </Card>
              <ObjetivoPanel />
            </div>
          </div>

          {/* Columna derecha: turnos arriba, ventas recientes ocupan el resto */}
          <div className="flex min-h-0 min-w-0 flex-col gap-3">
            <TurnosHeatmap className="shrink-0" />
            <RecentSales className="min-h-[260px] flex-1 xl:min-h-0" />
          </div>
        </div>
      </div>
    </Section>
  );
}
