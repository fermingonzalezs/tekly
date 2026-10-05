"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { RubrosPie } from "@/components/dashboard/rubros-pie";
import { ObjetivoPanel } from "@/components/dashboard/objetivo-panel";
import { RepairsChart } from "@/components/dashboard/repairs-chart";
import { DASH_PERIODOS, type DashPeriodo } from "@/lib/mock-data";
import type { MetricaDashboard } from "@/lib/dashboard";
import { TICKET_FLOW } from "@/lib/status";
import type { Ticket } from "@/lib/types";
import { Reveal } from "./ui/reveal";
import { GLASS_STRONG } from "./ui/glass";
import { SectionHeading, SECTION_WRAP } from "./ui/section-heading";

/**
 * Analíticas: en vez de dibujar gráficos "parecidos", la landing monta los
 * MISMOS widgets del dashboard de la app (components/dashboard/*) con datos
 * de ejemplo deterministas -- si cambia un gráfico en la app, cambia acá
 * solo. El selector de período es el real (`DASH_PERIODOS`) y funciona: cambia
 * la serie de tendencia y el mix de categorías, igual que en el dashboard.

 */

// Serie diaria determinista (sin Math.random: SSR e hidratación tienen que
// coincidir). Suma de senos + un pico los sábados, redondeada a 10.
function serie(len: number, seed: number): number[] {
  return Array.from({ length: len }, (_, i) => {
    const v =
      1050 +
      320 * Math.sin(i * 0.7 + seed) +
      210 * Math.sin(i * 1.9 + seed * 2) +
      (i % 7 === 5 ? 420 : 0);
    return Math.round(Math.max(180, v) / 10) * 10;
  });
}

function trend(len: number, seed: number) {
  const venta = serie(len, seed);
  const ganancia = venta.map((v, i) => Math.round((v * (0.27 + 0.05 * Math.sin(i + seed))) / 10) * 10);
  return { venta, ganancia };
}

const TREND: Record<DashPeriodo, { venta: number[]; ganancia: number[] }> = {
  mes: trend(30, 0.4),
  mesPrevio: trend(30, 2.1),
  quince: trend(15, 1.3),
};

const RUBROS: Record<DashPeriodo, { label: string; value: number }[]> = {
  mes: [
    { label: "Equipos", value: 58 },
    { label: "Reparaciones", value: 22 },
    { label: "Accesorios", value: 14 },
    { label: "Otros", value: 6 },
  ],
  mesPrevio: [
    { label: "Equipos", value: 61 },
    { label: "Reparaciones", value: 19 },
    { label: "Accesorios", value: 12 },
    { label: "Otros", value: 8 },
  ],
  quince: [
    { label: "Equipos", value: 54 },
    { label: "Reparaciones", value: 25 },
    { label: "Accesorios", value: 15 },
    { label: "Otros", value: 6 },
  ],
};

const METRICAS: MetricaDashboard[] = [
  { key: "ventas", label: "Ventas del mes", value: "U$ 34.120", delta: 18.2, deltaHint: "vs mes anterior" },
  { key: "margen", label: "Margen promedio", value: "31.4 %", delta: 2.1, deltaHint: "vs mes anterior" },
  { key: "ticket", label: "Ticket promedio", value: "U$ 512", delta: 4.3, deltaHint: "vs mes anterior" },
  { key: "turnos", label: "Turnos hoy", value: "7", deltaHint: "agendados" },
];

// Los widgets de reparaciones solo leen `estado` -- alcanza con eso.
const TICKETS_POR_ESTADO = [4, 3, 2, 3, 6, 2, 7, 11];
const TICKETS = TICKET_FLOW.flatMap((estado, i) =>
  Array.from({ length: TICKETS_POR_ESTADO[i] }, () => ({ estado }) as Ticket),
);

const OBJETIVO = {
  current: 34120,
  dayOfMonth: 20,
  daysInMonth: 31,
  prevMes: "mes anterior",
  prevTotal: 28870,
  target: 45000,
};

export function MarketingAnaliticas() {
  const [periodo, setPeriodo] = useState<DashPeriodo>("mes");
  const meta = DASH_PERIODOS.find((p) => p.value === periodo)!;

  return (
    <section id="analiticas" className={`${SECTION_WRAP} flex scroll-mt-20 flex-col gap-12 pb-20 sm:pb-36`}>
      <SectionHeading
        layout="center"
        eyebrow="Analíticas"
        title="Tus números, sin pedirle nada a nadie"
        lead="Como todo se carga en un solo lugar, los reportes se arman solos. Abrís el panel y ya está."
      />

      <Reveal className="relative">
        <div
          aria-hidden="true"
          className="absolute -left-10 top-10 h-[220px] w-[220px] -rotate-[8deg] rounded-[48px] bg-accent-soft"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-8 -right-8 h-[180px] w-[180px] rotate-12 rounded-[40px] bg-accent/85"
        />

        <div className={`relative flex flex-col gap-3 rounded-[30px] p-4 sm:p-6 ${GLASS_STRONG}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
            <span className="font-display text-[22px] font-bold tracking-[-0.01em]">
              Resumen del mes
            </span>
            <Tabs
              value={periodo}
              onChange={setPeriodo}
              options={DASH_PERIODOS.map((p) => ({ value: p.value, label: p.label }))}
              className="gap-1.5 [&>button]:bg-white"
            />
          </div>

          {/* 4 métricas sin destacada -> la grilla de MetricCards cierra en
              4 columnas sola (celdas = métricas). */}
          <MetricCards metrics={METRICAS} />

          <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] [&>*]:min-w-0">
            <TrendChart
              className="xl:min-h-[300px]"
              venta={TREND[periodo].venta}
              ganancia={TREND[periodo].ganancia}
              rubroMix={RUBROS[periodo]}
              sub={meta.trendSub}
            />
            <RepairsChart tickets={TICKETS} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
            <Card className="flex min-w-0 flex-col p-4">
              <RubrosPie data={RUBROS[periodo]} totalFacturado={OBJETIVO.current} />
            </Card>
            <ObjetivoPanel {...OBJETIVO} />
          </div>

          <span className="text-xs text-neutral-500">
            Pasá el mouse por las barras de la tendencia · Datos de ejemplo.
          </span>
        </div>
      </Reveal>
    </section>
  );
}
