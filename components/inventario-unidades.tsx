import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { cn } from "@/lib/utils";
import {
  celulares as celularesSeed,
  repuestos as repuestosSeed,
  otros as otrosSeed,
} from "@/lib/mock-data";
import { CHART_COLORS as COLORS } from "@/lib/chart";
import { otroCantidad } from "@/lib/otros";
import type { Celular, OtroItem, Repuesto } from "@/lib/types";

export function InventarioUnidades({
  className,
  celulares = celularesSeed,
  repuestos = repuestosSeed,
  otros = otrosSeed,
}: {
  className?: string;
  celulares?: Celular[];
  repuestos?: Repuesto[];
  otros?: OtroItem[];
}) {
  const rows = [
    { label: "Celulares", value: celulares.length },
    { label: "Repuestos", value: repuestos.reduce((a, r) => a + r.stock, 0) },
    {
      label: "Otros",
      value: otros.reduce((a, o) => a + otroCantidad(o), 0),
    },
  ];
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;

  const slices = rows.map((r, i) => ({
    label: r.label,
    pct: Math.round((r.value / total) * 100),
    color: COLORS[i % COLORS.length],
    valueLabel: `${r.value} u.`,
  }));

  return (
    <Card className={cn("flex h-auto flex-col overflow-hidden p-4 lg:h-72", className)}>
      <ChartTitle align="left" divider>
        Unidades por categoría
      </ChartTitle>
      <div className="flex min-h-0 flex-1 items-center">
        <DonutChart slices={slices} legend="row" />
      </div>
    </Card>
  );
}
