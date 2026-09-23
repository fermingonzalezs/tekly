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
import { DASH_PERIODOS, type DashPeriodo } from "@/lib/mock-data";
import type { MetricaDashboard, ObjetivoMes, VentaReciente } from "@/lib/dashboard";
import type { Turno } from "@/lib/types";

export function DashboardClient({
  metrics,
  objetivo,
  objetivoTarget,
  trendByPeriodo,
  rubrosPorPeriodo,
  recentSales,
  turnos,
}: {
  metrics: MetricaDashboard[];
  objetivo: ObjetivoMes;
  objetivoTarget: number;
  trendByPeriodo: Record<DashPeriodo, { venta: number[]; ganancia: number[] }>;
  rubrosPorPeriodo: Record<DashPeriodo, { label: string; value: number }[]>;
  recentSales: VentaReciente[];
  turnos: Turno[];
}) {
  const [periodo, setPeriodo] = useState<DashPeriodo>("mes");
  const meta = DASH_PERIODOS.find((p) => p.value === periodo)!;
  const trend = trendByPeriodo[periodo];

  return (
    <Section
      title="Dashboard"
      toolbar={
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
      }
      // En pantallas xl el dashboard entra completo en el viewport: alto =
      // 100dvh menos TopNav (h-16) + Topbar (h-14), sin scroll de página.
      // Debajo de xl las columnas se apilan y se deja scrollear con normalidad
      // -- ahí el `p-4` no alcanza como margen inferior real (la tarjeta de
      // Ventas recientes termina pegada al borde de la pantalla), así que
      // solo debajo de xl se suma `pb-8`.
      mainClassName="flex flex-col p-4 pb-8 xl:pb-4 xl:h-[calc(100dvh-7.5rem)] xl:overflow-hidden"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <MetricCards metrics={metrics} />

        <div className="grid min-h-0 flex-1 items-stretch gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* Columna izquierda: tendencia (se estira) + rubros/objetivo */}
          <div className="flex min-h-0 min-w-0 flex-col gap-3">
            <TrendChart
              className="min-h-0 flex-1"
              venta={trend.venta}
              ganancia={trend.ganancia}
              rubroMix={rubrosPorPeriodo[periodo]}
              sub={meta.trendSub}
            />
            <div className="grid min-w-0 shrink-0 gap-3 sm:grid-cols-2">
              <Card className="flex min-w-0 flex-col p-4">
                <RubrosPie
                  data={rubrosPorPeriodo[periodo]}
                  totalFacturado={objetivo.current}
                />
              </Card>
              <ObjetivoPanel
                current={objetivo.current}
                dayOfMonth={objetivo.dayOfMonth}
                daysInMonth={objetivo.daysInMonth}
                prevMes={objetivo.prevMes}
                prevTotal={objetivo.prevTotal}
                target={objetivoTarget}
              />
            </div>
          </div>

          {/* Columna derecha: turnos arriba, ventas recientes ocupan el resto */}
          <div className="flex min-h-0 min-w-0 flex-col gap-3">
            <TurnosHeatmap className="shrink-0" turnos={turnos} />
            <RecentSales className="min-h-[260px] flex-1 xl:min-h-0" sales={recentSales} />
          </div>
        </div>
      </div>
    </Section>
  );
}
