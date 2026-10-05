"use client";

import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { StatCard } from "@/components/ui/stat-card";
import { CHART_ACCENT } from "@/lib/chart";
import { fmtUsd } from "@/lib/format";
import { Treemap } from "@/components/analiticas/treemap";
import { TendenciaRubros } from "@/components/analiticas/tendencia-rubros";
import { PeriodoChip } from "@/components/analiticas/periodo-chip";
import { BarRows, BarColumns } from "../bar-rows";
import type { ResumenVentasAnaliticas } from "@/lib/analiticas-resumen";

export function VentasTab({ resumen }: { resumen: ResumenVentasAnaliticas }) {
  const maxGanancia = Math.max(1, ...resumen.margenPorTipo.map((r) => r.gananciaUsd));
  const gananciaRows = [...resumen.margenPorTipo]
    .map((r) => ({ label: r.tipo, value: r.gananciaUsd }))
    .sort((a, b) => b.value - a.value);

  // Facturación acumulada (ancho completo) -- sparkline SVG.
  const W = 640;
  const H = 160;
  const acum = resumen.facturacionAcumulada.valores;
  const maxAcum = acum.length ? acum[acum.length - 1] || 1 : 1;
  const pts = acum.map((v, i) => {
    const x = (i / Math.max(1, acum.length - 1)) * W;
    const y = H - (v / maxAcum) * (H - 12);
    return `${x},${y}`;
  });
  const line = acum.length ? `M${pts.join(" L")}` : "";
  const area = acum.length ? `${line} L${W},${H} L0,${H} Z` : "";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Facturación"
          value={fmtUsd(resumen.facturacion)}
          delta={resumen.deltas.facturacion}
        />
        <StatCard
          label="Ticket promedio"
          value={fmtUsd(Math.round(resumen.ticketPromedio))}
          delta={resumen.deltas.ticketPromedio}
        />
        <StatCard
          label="Operaciones"
          value={resumen.operaciones}
          delta={resumen.deltas.operaciones}
        />
        <StatCard
          label="Margen promedio"
          value={resumen.margenPct !== null ? `${resumen.margenPct.toFixed(1)}%` : "—"}
          hint={resumen.margenPct === null ? "sin costos cargados" : undefined}
          delta={resumen.deltas.margen}
        />
      </div>

      <Card className="p-5">
        <ChartTitle align="left" divider sub="facturación acumulada del período">
          Facturación acumulada
        </ChartTitle>
        <div className="mt-4 flex items-end justify-between">
          <span className="font-grotesk text-2xl font-semibold tabular-nums">
            {fmtUsd(maxAcum)}
          </span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 h-40 w-full">
          <defs>
            <linearGradient id="acumFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_ACCENT} stopOpacity="0.18" />
              <stop offset="100%" stopColor={CHART_ACCENT} stopOpacity="0" />
            </linearGradient>
          </defs>
          {acum.length > 0 && (
            <>
              <path d={area} fill="url(#acumFill)" />
              <path
                d={line}
                fill="none"
                stroke={CHART_ACCENT}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>
      </Card>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <ChartTitle align="left" divider sub="facturación y operaciones por vendedor">
            Ranking por vendedor
          </ChartTitle>
          <BarRows
            rows={resumen.porVendedor.map((v) => ({ label: v.label, value: v.value }))}
            fmt={fmtUsd}
            suffix={(r) => {
              const v = resumen.porVendedor.find((x) => x.label === r.label)!;
              return `${v.pct.toFixed(0)}% · ${v.operaciones} op`;
            }}
          />
        </Card>
        <Card className="p-5">
          <ChartTitle align="left" divider>Ventas por canal</ChartTitle>
          <BarRows rows={resumen.porCanal} fmt={fmtUsd} />
        </Card>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <ChartTitle align="left" divider sub="del período filtrado">
            Mix de rubros
          </ChartTitle>
          <div className="mt-3 border-t border-neutral-100 pt-3">
            <Treemap data={resumen.rubroTreemap} fmt={fmtUsd} />
          </div>
        </Card>
        <Card className="p-5">
          <ChartTitle align="left" divider sub="ganancia real por rubro">
            Ganancia por categoría
          </ChartTitle>
          <div className="mt-5 flex h-40 items-end gap-3">
            {gananciaRows.map((r) => (
              <div key={r.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[11px] font-medium text-neutral-500">
                  {r.value > 0 ? fmtUsd(r.value) : ""}
                </span>
                <div
                  className="w-full rounded-t-xl bg-accent"
                  style={{ height: `${Math.max(3, (r.value / maxGanancia) * 100)}%` }}
                />
                <span className="w-full truncate text-center text-xs text-neutral-500">
                  {r.label}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <ChartTitle align="left" divider sub="promedio facturado, por día de la semana">
          Venta promedio por día de la semana
        </ChartTitle>
        <BarColumns
          rows={resumen.porDiaSemana.map((d) => ({ label: d.dia, value: d.promedioUsd }))}
          fmt={fmtUsd}
        />
      </Card>

      <TendenciaRubros data={resumen.rubroMes} className="min-h-[340px]" />
      {resumen.rubroMesChip && (
        <p className="-mt-4 text-xs text-neutral-500">
          Tendencia por rubro: <PeriodoChip>{resumen.rubroMesChip}</PeriodoChip>
        </p>
      )}
    </div>
  );
}
