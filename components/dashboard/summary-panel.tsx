import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { RubrosPie } from "@/components/dashboard/rubros-pie";
import { InventarioPie } from "@/components/dashboard/inventario-pie";
import { monthGoal, ventas } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";

export function SummaryPanel() {
  const pct = Math.round(
    Math.min(1, monthGoal.current / monthGoal.target) * 100,
  );
  const falta = Math.max(0, monthGoal.target - monthGoal.current);
  const nVentas = ventas.filter((v) => v.tipo === "venta").length;
  const nReparaciones = ventas.filter((v) => v.tipo === "reparacion").length;
  const facturado = ventas.reduce((a, v) => a + v.totalUsd, 0);

  return (
    <Card className="flex flex-col p-5">
      <ChartTitle>Resumen del mes</ChartTitle>

      <div className="mt-4 flex flex-1 flex-col justify-between gap-6">
        <RubrosPie />

        <div className="border-t border-neutral-100 pt-6">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Objetivo del mes
          </p>

          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-semibold tabular-nums">{pct}%</span>
            <span className="text-xs text-neutral-400">del objetivo</span>
          </div>
          <div className="mt-2 h-8 overflow-hidden rounded-lg bg-neutral-100">
            <div
              className="h-full rounded-lg bg-gradient-to-r from-blue-400 to-accent"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-center text-xs text-neutral-500">
            <span className="font-semibold text-neutral-800">
              {fmtUsd(monthGoal.current)}
            </span>{" "}
            / {fmtUsd(monthGoal.target)} · faltan {fmtUsd(falta)}
          </p>

          <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
            <li>
              <span className="font-semibold tabular-nums">{nVentas}</span>{" "}
              <span className="text-neutral-500">Ventas</span>
            </li>
            <li>
              <span className="font-semibold tabular-nums">{nReparaciones}</span>{" "}
              <span className="text-neutral-500">Reparac.</span>
            </li>
            <li>
              <span className="font-semibold tabular-nums">
                {fmtUsd(facturado)}
              </span>{" "}
              <span className="text-neutral-500">Facturado</span>
            </li>
          </ul>
        </div>

        <div className="border-t border-neutral-100 pt-6">
          <InventarioPie />
        </div>
      </div>
    </Card>
  );
}
