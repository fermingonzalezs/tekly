import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/format";
import { CHART_COLORS as COLORS } from "@/lib/chart";
import { valorInventario } from "@/lib/inventario";
import type { Celular, Notebook, OtroItem, Repuesto } from "@/lib/types";

/** Valor de inventario a costo, por categoría (fuente única: `valorInventario`
 *  en `lib/inventario.ts`, que excluye vendidos **y extraviados**). Se usa en
 *  Analíticas → Inventario; el mismo cálculo alimenta el Activo del
 *  Patrimonio. `notebooks` es opcional: si no se pasa, la categoría va en 0. */
export function InventarioValor({
  className,
  celulares,
  notebooks = [],
  repuestos,
  otros,
}: {
  className?: string;
  celulares: Celular[];
  notebooks?: Notebook[];
  repuestos: Repuesto[];
  otros: OtroItem[];
}) {
  const { total: totalReal, porCategoria } = valorInventario({
    celulares,
    notebooks,
    repuestos,
    otros,
  });

  const rows = porCategoria
    .filter((c) => c.valor > 0 || c.unidades > 0)
    .map((c) => ({ label: c.label, value: c.valor }));
  const total = totalReal || 1;

  return (
    <Card className={cn("flex h-full flex-col overflow-hidden p-4", className)}>
      <ChartTitle align="left" divider>
        Valor de inventario
      </ChartTitle>

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          Valor total
        </p>
        <p className="text-2xl font-semibold tabular-nums">{fmtUsd(totalReal)}</p>

        <div className="mt-3 flex gap-[3px] overflow-hidden rounded-full">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className="flex h-9 items-center justify-center overflow-hidden"
              style={{
                width: `${(r.value / total) * 100}%`,
                background: COLORS[i % COLORS.length],
              }}
            >
              <span className="truncate px-1 text-[11px] font-semibold text-white">
                {fmtUsd(r.value)}
              </span>
            </div>
          ))}
        </div>

        <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[13px]">
          {rows.map((r, i) => (
            <li key={r.label} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="whitespace-nowrap text-neutral-600">{r.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
