import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { RubrosPie } from "@/components/dashboard/rubros-pie";
import { ObjetivoPanel } from "@/components/dashboard/objetivo-panel";
import { InventarioBar } from "@/components/dashboard/inventario-bar";
import { TurnosGauge } from "@/components/dashboard/turnos-gauge";
import { recentSales } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";

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
          <TrendChart className="min-h-0" />

          {/* Columna derecha: rubros + objetivo arriba, ventas recientes al fondo */}
          <div className="flex min-h-0 flex-col gap-3">
            <div className="grid min-h-0 flex-1 gap-3 sm:grid-cols-2 sm:grid-rows-1">
              <Card className="flex flex-col justify-center p-4">
                <RubrosPie />
              </Card>
              <ObjetivoPanel />
            </div>

            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center justify-between px-4 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Ventas recientes
                </p>
                <span className="text-xs text-neutral-400">Últimas 5</span>
              </div>
              <div className="mt-1.5 min-h-0 flex-1 overflow-auto">
                <table className="h-full w-full text-[13px]">
                  <thead>
                    <tr className="text-xs text-neutral-400">
                      <th className="px-4 py-1.5 font-medium">Venta</th>
                      <th className="px-4 py-1.5 font-medium">Cliente</th>
                      <th className="px-4 py-1.5 font-medium">Ítem</th>
                      <th className="px-4 py-1.5 font-medium">Vendedor</th>
                      <th className="px-4 py-1.5 font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.map((s) => (
                      <tr
                        key={s.id}
                        className="border-t border-neutral-100 last:border-b-0"
                      >
                        <td className="px-4 py-3 font-medium text-neutral-500">
                          {s.id}
                        </td>
                        <td className="px-4 py-3">{s.cliente}</td>
                        <td className="px-4 py-3 text-neutral-500">{s.item}</td>
                        <td className="px-4 py-3">{s.vendedor}</td>
                        <td className="px-4 py-3 font-semibold">
                          {fmtUsd(s.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
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
