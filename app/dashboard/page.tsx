import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { RubrosPie } from "@/components/dashboard/rubros-pie";
import { ObjetivoPanel } from "@/components/dashboard/objetivo-panel";
import { InventarioBar } from "@/components/dashboard/inventario-bar";
import { TurnosGauge } from "@/components/dashboard/turnos-gauge";
import { RecentSales } from "@/components/dashboard/recent-sales";

export default function DashboardPage() {
  return (
    <Section
      title="Dashboard"
      // En xl+ el dashboard entra entero en la ventana (TopNav 64 + Topbar 56).
      // Debajo de xl la grilla colapsa a 1 columna y se permite scroll normal.
      mainClassName="p-4 xl:h-[calc(100vh-120px)] xl:overflow-hidden"
    >
      <div className="flex flex-col gap-3 xl:h-full">
        <MetricCards />

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:grid-rows-1">
          {/* Columna izquierda: tendencia de ventas */}
          <TrendChart className="min-h-0 xl:max-h-[300px] xl:self-start" />

          {/* Columna derecha: rubros + objetivo arriba, ventas recientes al fondo */}
          <div className="flex min-h-0 flex-col gap-3">
            <div className="grid min-h-0 flex-1 gap-3 sm:grid-cols-2 sm:grid-rows-1">
              <Card className="flex flex-col justify-center p-4">
                <RubrosPie />
              </Card>
              <ObjetivoPanel />
            </div>

            <RecentSales className="flex-1" />
          </div>
        </div>

        {/* Fila inferior */}
        <div className="grid shrink-0 gap-3 xl:h-[212px] xl:grid-cols-2">
          <InventarioBar />
          <TurnosGauge />
        </div>
      </div>
    </Section>
  );
}
