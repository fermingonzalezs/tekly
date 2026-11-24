"use client";

import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { StatCard } from "@/components/ui/stat-card";
import { BarRows, BarColumns } from "../bar-rows";
import type { ResumenTurnos } from "@/lib/analiticas-resumen";

export function TurnosTab({ resumen }: { resumen: ResumenTurnos }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Turnos" value={resumen.total} hint="del período" />
        <StatCard label="Confirmados" value={resumen.confirmados} />
        <StatCard
          label="Cancelados"
          value={resumen.cancelados}
          valueClassName={resumen.cancelados > 0 ? "text-red-500" : undefined}
        />
        <StatCard
          label="Asistencia"
          value={resumen.tasaAsistencia === null ? "—" : `${resumen.tasaAsistencia.toFixed(0)}%`}
          hint={`${resumen.atendidos} atendidos · ${resumen.noVino} no vinieron`}
        />
        <StatCard
          label="Vencidos sin marcar"
          value={resumen.sinConfirmarPasados}
          hint="ya pasaron y nadie marcó atendido / no vino"
        />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <ChartTitle align="left" divider>Tasa de confirmación</ChartTitle>
          <div className="mt-4">
            <span className="font-grotesk text-3xl font-semibold tabular-nums">
              {resumen.tasaConfirmacion.toFixed(0)}%
            </span>
          </div>
          <BarRows
            rows={[
              { label: "Confirmados", value: resumen.confirmados },
              { label: "Sin confirmar", value: resumen.pendientes },
              { label: "Atendidos", value: resumen.atendidos },
              { label: "No vino", value: resumen.noVino },
              { label: "Cancelados", value: resumen.cancelados },
            ]}
          />
        </Card>
        <Card className="p-5">
          <ChartTitle align="left" divider>Turnos por tipo</ChartTitle>
          <BarRows rows={resumen.porTipo} />
        </Card>
      </div>

      <Card className="p-5">
        <ChartTitle align="left" divider sub="estado de los turnos del período">
          Estado de los turnos
        </ChartTitle>
        <BarRows rows={resumen.porEstado} />
      </Card>

      <Card className="p-5">
        <ChartTitle align="left" divider sub="09 a 20 h, del período">
          Ocupación por franja horaria
        </ChartTitle>
        <BarColumns rows={resumen.porHora} />
      </Card>
    </div>
  );
}
