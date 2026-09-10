import { DonutChart } from "@/components/dashboard/donut-chart";
import { ChartTitle } from "@/components/ui/chart-title";
import { ventasPorRubro, monthGoal } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";
import { DASH_COLORS as COLORS } from "@/lib/chart";

export function RubrosPie({
  data = ventasPorRubro.mes,
}: {
  data?: { label: string; value: number }[];
}) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;

  const slices = data.map((d, i) => ({
    label: d.label,
    pct: Math.round((d.value / total) * 100),
    color: COLORS[i % COLORS.length],
    valueLabel: fmtUsd(Math.round(monthGoal.current * (d.value / total))),
  }));

  return (
    <div className="w-full">
      <ChartTitle align="left" sub="Facturación del mes por categoría">
        Categorías más vendidas
      </ChartTitle>
      <div className="mt-3 border-t border-neutral-100 pt-3">
        <DonutChart slices={slices} />
      </div>
    </div>
  );
}
