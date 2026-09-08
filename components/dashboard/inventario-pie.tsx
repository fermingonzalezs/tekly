import { DonutChart } from "@/components/dashboard/donut-chart";
import { equipos, repuestos, otros } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";

const COLORS = ["#93c5fd", "#c4b5fd", "#fcd34d"];

export function InventarioPie() {
  const valEquipos = equipos
    .filter((e) => e.estado !== "vendido")
    .reduce((a, e) => a + e.costoUsd, 0);
  const valRepuestos = repuestos.reduce((a, r) => a + r.stock * r.costoUsd, 0);
  const valOtros = otros.reduce((a, o) => a + o.cantidad * o.costoUsd, 0);

  const data = [
    { label: "Equipos", value: valEquipos },
    { label: "Repuestos", value: valRepuestos },
    { label: "Otros", value: valOtros },
  ];
  const total = data.reduce((a, d) => a + d.value, 0) || 1;

  const slices = data.map((d, i) => ({
    label: d.label,
    pct: Math.round((d.value / total) * 100),
    color: COLORS[i % COLORS.length],
    valueLabel: fmtUsd(d.value),
  }));

  return (
    <div className="w-full">
      <p className="text-center text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Valor de inventario
      </p>
      <div className="mt-3">
        <DonutChart slices={slices} />
      </div>
    </div>
  );
}
