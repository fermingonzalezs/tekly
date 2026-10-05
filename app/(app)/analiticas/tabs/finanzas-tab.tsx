"use client";

import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { StatCard } from "@/components/ui/stat-card";
import { fmtArs, fmtUsd } from "@/lib/format";
import { CHART_COLORS } from "@/lib/chart";
import { cn } from "@/lib/utils";
import { RentabilidadEvolucion } from "@/components/analiticas/rentabilidad-linea";
import { WaterfallResultado } from "@/components/analiticas/waterfall-resultado";
import { ScatterMargen } from "@/components/analiticas/scatter-margen";
import { FlujoCaja } from "@/components/analiticas/flujo-caja";
import { DonutChart } from "@/components/dashboard/donut-chart";
import type { ResumenFinanzas } from "@/lib/analiticas-resumen";

export function FinanzasTab({ resumen }: { resumen: ResumenFinanzas }) {
  const maxGasto = Math.max(1, ...resumen.gastosPorCategoria.filas.map((g) => g.monto));
  const maxComprasVentas = Math.max(
    1,
    ...resumen.comprasVentasMes.flatMap((m) => [m.ventas, m.compras]),
  );
  const { sinCotizacion } = resumen;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Ingresos (cajas)" value={fmtUsd(resumen.ingresosUsd)} delta={resumen.deltas.ingresos} />
        <StatCard label="Egresos (cajas)" value={fmtUsd(resumen.egresosUsd)} delta={resumen.deltas.egresos} />
        <StatCard
          label="Neto (cajas)"
          value={fmtUsd(resumen.netoUsd)}
          valueClassName={resumen.netoUsd < 0 ? "text-red-500" : undefined}
          delta={resumen.deltas.neto}
        />
        <StatCard label="Ganancia (ventas)" value={fmtUsd(resumen.gananciaVentas)} delta={resumen.deltas.ganancia} />
      </div>

      {sinCotizacion.cantidad > 0 && (
        <p className="text-xs text-neutral-500">
          Además hay {fmtArs(sinCotizacion.ingresosArs)} de ingresos y{" "}
          {fmtArs(sinCotizacion.egresosArs)} de egresos en pesos registrados antes de
          guardar la cotización (no incluidos en los totales en USD).
        </p>
      )}

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <RentabilidadEvolucion data={resumen.rentabilidadMes} />
        <WaterfallResultado rows={resumen.margenPorTipo} />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <ScatterMargen rows={resumen.margenPorTipo} />
        <Card className="p-5">
          <ChartTitle align="left" divider>Ingresos por medio de pago</ChartTitle>
          <div className="mt-3 border-t border-neutral-100 pt-3">
            <DonutChart slices={resumen.porMedio} />
          </div>
        </Card>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <FlujoCaja meses={resumen.flujoMes} />

        <Card className="flex h-full flex-col p-5">
          <ChartTitle
            align="left"
            divider
            sub={
              resumen.cobertura != null
                ? `cobertura del período: ${resumen.cobertura.toFixed(1)}× de venta por USD comprado`
                : "inversión en stock vs facturación"
            }
          >
            Compras vs ventas por mes
          </ChartTitle>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[1] }} />
              Ventas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[3] }} />
              Compras
            </span>
          </div>
          {resumen.comprasVentasMes.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500">
              Sin ventas ni compras en el período filtrado.
            </p>
          ) : (
            <div className="mt-auto flex h-40 items-end gap-3 pt-5 sm:gap-4">
              {resumen.comprasVentasMes.map((m) => {
                const ratio = m.compras > 0 ? m.ventas / m.compras : null;
                return (
                  <div key={m.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    <div
                      className="flex h-full w-full items-end justify-center gap-1.5"
                      title={`${m.label}: ventas ${fmtUsd(m.ventas)} · compras ${fmtUsd(m.compras)}${ratio != null ? ` · cobertura ${ratio.toFixed(1)}×` : " · sin compras este mes"}`}
                    >
                      <div
                        className="w-[38%] rounded-t-md"
                        style={{ background: CHART_COLORS[1], height: `${Math.max(3, (m.ventas / maxComprasVentas) * 100)}%` }}
                      />
                      <div
                        className="w-[38%] rounded-t-md"
                        style={{ background: CHART_COLORS[3], height: `${Math.max(3, (m.compras / maxComprasVentas) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-neutral-500">{m.label}</span>
                    <span
                      className={cn(
                        "text-[10px] font-medium tabular-nums",
                        ratio == null
                          ? "text-neutral-500"
                          : ratio >= 1
                            ? "text-emerald-600"
                            : "text-red-500",
                      )}
                    >
                      {ratio != null ? `${ratio.toFixed(1)}×` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <ChartTitle
          align="left"
          divider
          sub="egresos de cajas, en USD — agrupados por categoría"
        >
          Gastos por categoría
        </ChartTitle>
        {resumen.gastosPorCategoria.filas.length === 0 ? (
          <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500">
            Sin egresos en el período filtrado.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {resumen.gastosPorCategoria.filas.slice(0, 6).map((g) => (
              <li
                key={g.categoria}
                title={`${g.categoria}: ${fmtUsd(g.monto)} (${g.pct.toFixed(1)}% del gasto total)`}
              >
                <div className="flex items-center gap-3 text-[13px]">
                  <span className="w-28 shrink-0 truncate text-neutral-600 sm:w-36">
                    {g.categoria}
                  </span>
                  <div className="h-2 min-w-0 flex-1 rounded-full bg-neutral-100">
                    <div
                      className="h-2 rounded-full bg-accent"
                      style={{ width: `${(g.monto / maxGasto) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right font-semibold tabular-nums">
                    {fmtUsd(g.monto)}
                  </span>
                  <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-neutral-500">
                    {Math.round(g.pct)}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
