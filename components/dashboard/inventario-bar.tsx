import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { equipos, repuestos, otros } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";

const COLORS = ["#10b981", "#f59e0b", "#3b82f6"];

export function InventarioBar({ className }: { className?: string }) {
  const valEquipos = equipos
    .filter((e) => e.estado !== "vendido")
    .reduce((a, e) => a + e.costoUsd, 0);
  const valRepuestos = repuestos.reduce((a, r) => a + r.stock * r.costoUsd, 0);
  const valOtros = otros.reduce((a, o) => a + o.cantidad * o.costoUsd, 0);

  const rows = [
    { label: "Equipos", value: valEquipos },
    { label: "Repuestos", value: valRepuestos },
    { label: "Otros", value: valOtros },
  ];
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;

  return (
    <Card className={cn("flex flex-col overflow-hidden p-4", className)}>
      <ChartTitle align="left">Valor de inventario</ChartTitle>

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
          Valor total
        </p>
        <p className="text-2xl font-semibold tabular-nums">{fmtUsd(total)}</p>

        <div className="mt-3 flex gap-[3px] overflow-hidden rounded-md">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className="h-3.5"
              style={{
                width: `${(r.value / total) * 100}%`,
                background: COLORS[i % COLORS.length],
              }}
            />
          ))}
        </div>

        <ul className="mt-3 space-y-2 text-[13px]">
          {rows.map((r, i) => (
            <li key={r.label} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="text-neutral-600">{r.label}</span>
              <span className="ml-auto font-semibold tabular-nums">
                {fmtUsd(r.value)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
