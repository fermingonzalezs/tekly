"use client";

import { useMemo, useState } from "react";
import { StatCard } from "@/components/ui/stat-card";
import { fmtUsd } from "@/lib/format";
import { ValueMap } from "@/components/analiticas/clientes/value-map";
import { ComprasReparacionesMap } from "@/components/analiticas/clientes/compras-reparaciones-map";
import { LifecycleSankey } from "@/components/analiticas/clientes/lifecycle-sankey";
import { CohortHeatmap } from "@/components/analiticas/clientes/cohort-heatmap";
import { RevenueTimeline } from "@/components/analiticas/clientes/revenue-timeline";
import { ProcedenciaRanking } from "@/components/analiticas/clientes/procedencia-ranking";
import { AtencionClientes } from "@/components/analiticas/clientes/atencion-clientes";
import { DIAS_ACTIVO, DIAS_RIESGO } from "@/lib/clientes-inteligencia";
import type { ResumenClientes } from "@/lib/analiticas-resumen";

export function ClientesTab({ resumen }: { resumen: ResumenClientes }) {
  const [procedenciaFiltro, setProcedenciaFiltro] = useState<string | null>(null);
  const { kpis, intel, cohortes, flujo, ranking, ingresos, colores } = resumen;

  // Color por canal: el orden del ranking fija el tono de cada canal en TODOS
  // los gráficos del tab. "Sin dato" no entra a la paleta (gris neutro).
  const colorDe = useMemo(() => {
    const mapa = new Map(colores.map((c) => [c.procedencia, c.color]));
    return (procedencia: string | null) =>
      procedencia == null ? "#d4d4d8" : (mapa.get(procedencia) ?? "#d4d4d8");
  }, [colores]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Clientes activos"
          value={kpis.activos}
          delta={kpis.deltaActivos ?? undefined}
          deltaHint={`vs ventana previa (${DIAS_ACTIVO} días)`}
          hint={`con operaciones en los últimos ${DIAS_ACTIVO} días`}
        />
        <StatCard
          label="Valor por cliente activo"
          value={fmtUsd(Math.round(kpis.valorPromedio))}
          delta={kpis.deltaValorPromedio ?? undefined}
          deltaHint={`vs ventana previa (${DIAS_ACTIVO} días)`}
          hint={`gasto en los últimos ${DIAS_ACTIVO} días ÷ activos`}
        />
        <StatCard
          label="Tasa de recurrencia"
          value={`${kpis.tasaRecurrencia.toFixed(0)}%`}
          hint="con 2+ operaciones sobre los que tienen alguna"
        />
        <StatCard
          label="En riesgo"
          value={kpis.enRiesgo}
          valueClassName={kpis.enRiesgo > 0 ? "text-red-500" : undefined}
          hint={
            kpis.enRiesgo > 0
              ? `sin actividad hace ${DIAS_RIESGO}+ días · valen ${fmtUsd(kpis.riesgoValorUsd)}`
              : "nadie superó la ventana de riesgo"
          }
        />
      </div>

      <ValueMap intel={intel} filtro={procedenciaFiltro} colorDe={colorDe} />

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <ComprasReparacionesMap intel={intel} filtro={procedenciaFiltro} colorDe={colorDe} />
        <LifecycleSankey flujo={flujo} />
      </div>

      <CohortHeatmap cohortes={cohortes} intel={intel} />

      <RevenueTimeline ingresos={ingresos} />

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <ProcedenciaRanking
          ranking={ranking}
          filtro={procedenciaFiltro}
          onFiltro={setProcedenciaFiltro}
          colorDe={colorDe}
        />
        <AtencionClientes intel={intel} />
      </div>
    </div>
  );
}
