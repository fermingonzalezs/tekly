"use client";

import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { StatCard } from "@/components/ui/stat-card";
import { fmtUsd } from "@/lib/format";
import { FunnelReparaciones } from "@/components/analiticas/funnel-reparaciones";
import { GaugeAceptacion } from "@/components/analiticas/gauge-aceptacion";
import { HeatmapActividad } from "@/components/analiticas/heatmap-actividad";
import { PeriodoChip } from "@/components/analiticas/periodo-chip";
import type {
  ResumenReparaciones,
} from "@/lib/analiticas-resumen";
import type { AntiguedadTickets } from "@/lib/analiticas";

export function ReparacionesTab({
  resumen,
  antiguedad,
}: {
  resumen: ResumenReparaciones;
  antiguedad: AntiguedadTickets[];
}) {
  const maxAntiguedad = Math.max(1, ...antiguedad.map((r) => r.tickets));
  const maxPorFalla = Math.max(1, ...resumen.porFalla.map((f) => f.totalUsd));
  const maxCantidadPorFalla = Math.max(1, ...resumen.porFalla.map((f) => f.tickets));
  const { cobrado } = resumen;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Cobrado"
          value={fmtUsd(cobrado.totalUsd)}
          delta={resumen.cobradoDelta}
          hint={
            cobrado.ccUsd > 0
              ? `incl. ${fmtUsd(cobrado.ccUsd)} a cuenta corriente`
              : undefined
          }
        />
        <StatCard
          label="Reparaciones"
          value={resumen.cantidad}
          hint="ingresadas en el período"
        />
        <StatCard label="Gasto en repuestos" value={fmtUsd(resumen.gastoRepuestos)} />
        <StatCard label="Ganancia final" value={fmtUsd(resumen.gananciaFinal)} />
      </div>

      {resumen.sinCotizacionReparaciones.cantidad > 0 && (
        <p className="text-xs text-neutral-500">
          {resumen.sinCotizacionReparaciones.cantidad} cobro
          {resumen.sinCotizacionReparaciones.cantidad === 1 ? "" : "s"} en pesos anteriores
          al registro de cotización no están incluidos.
        </p>
      )}

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <ChartTitle
            align="left"
            divider
            sub={
              <>
                tickets sin entregar, ahora mismo <PeriodoChip>Estado actual</PeriodoChip>
              </>
            }
          >
            Antigüedad de tickets abiertos
          </ChartTitle>
          <ul className="mt-4 space-y-3">
            {antiguedad.map((r) => (
              <li key={r.rango}>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-neutral-600">{r.rango}</span>
                  <span className="font-semibold tabular-nums">{r.tickets} tickets</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-neutral-100">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: `${(r.tickets / maxAntiguedad) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <GaugeAceptacion
          presupuestadas={resumen.aceptacion.presupuestadas}
          aceptadas={resumen.aceptacion.aceptadas}
          pct={resumen.aceptacion.pct}
        />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <ChartTitle align="left" divider sub="por fecha de ingreso del ticket">
            Reparaciones por tipo de falla
          </ChartTitle>
          {resumen.porFalla.length === 0 ? (
            <p className="mt-4 text-center text-[13px] text-neutral-500">
              Sin tickets en el período.
            </p>
          ) : (
            <>
              <div className="mt-3 flex items-center gap-4 text-[11px] text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-accent" /> Facturado
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-neutral-400" /> Reparaciones
                </span>
              </div>
              <ul className="mt-3 space-y-2.5">
                {resumen.porFalla.map((f) => (
                  <li key={f.falla}>
                    <div className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="truncate text-neutral-600">
                        {f.falla}
                        <span className="ml-1.5 text-[11px] text-neutral-500">
                          {f.tickets} rep
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">{fmtUsd(f.totalUsd)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-neutral-100">
                      <div
                        className="h-2 rounded-full bg-accent"
                        style={{ width: `${(f.totalUsd / maxPorFalla) * 100}%` }}
                      />
                    </div>
                    <div className="mt-0.5 h-1.5 rounded-full bg-neutral-100">
                      <div
                        className="h-1.5 rounded-full bg-neutral-400"
                        style={{ width: `${(f.tickets / maxCantidadPorFalla) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
        <HeatmapActividad grid={resumen.actividadGrid} />
      </div>

      <FunnelReparaciones etapas={resumen.funnel} />
    </div>
  );
}
