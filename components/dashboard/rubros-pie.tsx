import { DonutChart } from "@/components/dashboard/donut-chart";
import { ChartTitle } from "@/components/ui/chart-title";
import { fmtUsd } from "@/lib/format";
import { DASH_COLORS as COLORS } from "@/lib/chart";

export function RubrosPie({
  data,
  totalFacturado,
}: {
  // Mix real Celulares/Reparaciones/Accesorios/Otros del período seleccionado
  // -- ver `ventasPorRubro` en `lib/dashboard.ts` (a partir de
  // `VentaItem.categoria`).
  data: { label: string; value: number }[];
  // Facturado del mes (ver `objetivoDelMes` en `lib/dashboard.ts`) -- se usa
  // para que el $ de cada porción sea correcto aunque el mix de categorías
  // siga siendo ilustrativo.
  totalFacturado: number;
}) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;

  const slices = data.map((d, i) => ({
    label: d.label,
    pct: Math.round((d.value / total) * 100),
    color: COLORS[i % COLORS.length],
    valueLabel: fmtUsd(Math.round(totalFacturado * (d.value / total))),
  }));

  return (
    <div className="w-full">
      <ChartTitle align="left" sub="Cómo se reparte la venta del mes">
        Vendido por rubro
      </ChartTitle>
      <div className="mt-3 border-t border-neutral-100 pt-3">
        <DonutChart slices={slices} />
      </div>
    </div>
  );
}
