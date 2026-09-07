import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { SummaryPanel } from "@/components/dashboard/summary-panel";
import { recentSales } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";

export default function DashboardPage() {
  return (
    <Section title="Dashboard">
      <div className="space-y-6">
        <MetricCards />

        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <TrendChart />

            <Card>
              <div className="flex items-center justify-between px-5 pt-5">
                <p className="text-sm font-semibold text-neutral-500">
                  Ventas recientes
                </p>
                <span className="text-xs text-neutral-400">Últimas 5</span>
              </div>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-400">
                    <th className="px-5 py-2 font-medium">Venta</th>
                    <th className="px-5 py-2 font-medium">Cliente</th>
                    <th className="px-5 py-2 font-medium">Ítem</th>
                    <th className="px-5 py-2 font-medium">Vendedor</th>
                    <th className="px-5 py-2 text-right font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((s) => (
                    <tr
                      key={s.id}
                      className="border-t border-neutral-100 last:border-b-0"
                    >
                      <td className="px-5 py-3 font-medium text-neutral-500">
                        {s.id}
                      </td>
                      <td className="px-5 py-3">{s.cliente}</td>
                      <td className="px-5 py-3 text-neutral-500">{s.item}</td>
                      <td className="px-5 py-3">{s.vendedor}</td>
                      <td className="px-5 py-3 text-right font-semibold">
                        {fmtUsd(s.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          <SummaryPanel />
        </div>
      </div>
    </Section>
  );
}
