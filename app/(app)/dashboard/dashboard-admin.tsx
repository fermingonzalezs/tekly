"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/button";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { RitmoChart } from "@/components/dashboard/ritmo-chart";
import { RubrosPie } from "@/components/dashboard/rubros-pie";
import { ObjetivoPanel } from "@/components/dashboard/objetivo-panel";
import { TurnosHeatmap } from "@/components/dashboard/turnos-heatmap";
import { RecentSales } from "@/components/dashboard/recent-sales";
import { useRefrescoEnVivo } from "@/components/dashboard/use-refresco-en-vivo";
import {
  etiquetaMes,
  moverMes,
  type MesDashboard,
  type MetricaDashboard,
  type ObjetivoMes,
  type RitmoMes,
  type VentaReciente,
} from "@/lib/dashboard";
import type { Turno } from "@/lib/types";

/** Dashboard de admin: KPIs con "Ventas del mes" destacada, ritmo del mes
 * (acumulado vs mes anterior vs ritmo ideal), mix de rubros, objetivo del mes y, a la derecha,
 * turnos agendados + ventas recientes. Se actualiza solo ante eventos de la
 * org (`useRefrescoEnVivo`). */
export function DashboardAdmin({
  metrics,
  objetivo,
  objetivoTarget,
  ritmo,
  rubros,
  mes,
  onMesChange,
  recentSales,
  turnos,
  ventasHref,
}: {
  metrics: MetricaDashboard[];
  objetivo: ObjetivoMes;
  objetivoTarget: number;
  ritmo: RitmoMes;
  rubros: { label: string; value: number }[];
  mes: MesDashboard;
  /** Cambio de mes. Sin esto navega con `?mes=YYYY-MM` (la app real); la
   * demo lo pasa para llevar el mes en estado local. */
  onMesChange?: (clave: string) => void;
  recentSales: VentaReciente[];
  turnos: Turno[];
  /** Base del link de "Ventas recientes" (en demo `/demo/ventas`). */
  ventasHref?: string;
}) {
  useRefrescoEnVivo();
  const router = useRouter();
  const pathname = usePathname();
  const [pendiente, startTransition] = useTransition();
  const irA = (clave: string) => {
    if (onMesChange) return onMesChange(clave);
    startTransition(() => router.replace(`${pathname}?mes=${clave}`, { scroll: false }));
  };

  return (
    <Section
      title="Dashboard"
      ayuda="dashboard"
      toolbar={
        <div className="flex items-center gap-1 rounded-full border border-neutral-900/10 bg-white px-1 shadow-sm">
          <IconButton
            aria-label="Mes anterior"
            icon={ChevronLeft}
            variant="ghost"
            size="sm"
            onClick={() => irA(moverMes(mes.clave, -1))}
          />
          <span className="min-w-[8.5rem] text-center text-sm font-medium tabular-nums">
            {etiquetaMes(mes.anio, mes.mes0)}
          </span>
          <IconButton
            aria-label="Mes siguiente"
            icon={ChevronRight}
            variant="ghost"
            size="sm"
            disabled={mes.esActual}
            onClick={() => irA(moverMes(mes.clave, 1))}
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
      <div
        className={`flex min-h-0 flex-1 flex-col gap-3 transition-opacity ${pendiente ? "opacity-60" : ""}`}
      >
        <MetricCards metrics={metrics} />

        {/* Grilla 2×2 en xl: fila de arriba a su alto natural (rubros/objetivo |
            turnos), fila de abajo reparte el resto -- así tendencia y ventas
            recientes miden siempre lo mismo. */}
        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:grid-rows-[auto_minmax(0,1fr)]">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:col-start-1 xl:row-start-1">
            <Card className="flex min-w-0 flex-col p-4">
              <RubrosPie
                data={rubros}
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
          <RitmoChart
            className="min-h-[260px] min-w-0 xl:col-start-1 xl:row-start-2 xl:min-h-0"
            ritmo={ritmo}
            target={objetivoTarget}
          />
          <TurnosHeatmap
            className="min-w-0 xl:col-start-2 xl:row-start-1"
            turnos={turnos}
          />
          <RecentSales
            className="min-h-[150px] min-w-0 xl:col-start-2 xl:row-start-2 xl:min-h-0"
            sales={recentSales}
            ventasHref={ventasHref}
          />
        </div>
      </div>
    </Section>
  );
}
