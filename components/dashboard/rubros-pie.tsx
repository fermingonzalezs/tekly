import { DonutChart } from "@/components/dashboard/donut-chart";
import { ventasPorRubro, monthGoal } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";

const COLORS = ["#93c5fd", "#c4b5fd", "#fcd34d", "#6ee7b7"];

export function RubrosPie() {
  const data = ventasPorRubro.mes;
  const total = data.reduce((a, d) => a + d.value, 0) || 1;

  const slices = data.map((d, i) => ({
    label: d.label,
    pct: Math.round((d.value / total) * 100),
    color: COLORS[i % COLORS.length],
    valueLabel: fmtUsd(Math.round(monthGoal.current * (d.value / total))),
  }));

  return (
    <div className="w-full">
      <p className="text-center text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Rubros más vendidos
      </p>
      <div className="mt-3">
        <DonutChart slices={slices} />
      </div>
    </div>
  );
}
