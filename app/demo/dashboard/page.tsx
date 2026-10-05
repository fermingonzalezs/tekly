"use client";

import { useMemo } from "react";
import { DashboardAdmin } from "@/app/(app)/dashboard/dashboard-admin";
import { useDemo } from "@/lib/demo/store";
import {
  metricasDashboard,
  objetivoDelMes,
  ventaGananciaPorPeriodo,
  ventasPorRubro,
  ventasRecientes,
} from "@/lib/dashboard";

/** Dashboard de la demo (rol admin), calculado sobre el store local. */
export default function DemoDashboardPage() {
  const { state } = useDemo();
  const hoy = useMemo(() => new Date(), []);

  const turnosHoy = state.turnos.filter(
    (t) => t.dayOffset === 0 && t.estado !== "cancelado",
  ).length;
  const ticketsAbiertos = state.tickets.filter(
    (t) => t.estado !== "entregado",
  ).length;

  return (
    <DashboardAdmin
      metrics={metricasDashboard({
        ventas: state.ventas,
        ticketsAbiertos,
        turnosHoy,
        hoy,
      })}
      objetivo={objetivoDelMes(state.ventas, hoy)}
      objetivoTarget={state.negocio.objetivoMesUsd}
      trendByPeriodo={ventaGananciaPorPeriodo(state.ventas, hoy)}
      rubrosPorPeriodo={ventasPorRubro(state.ventas, hoy)}
      recentSales={ventasRecientes(state.ventas, 6, hoy)}
      turnos={state.turnos}
      ventasHref="/demo/ventas"
    />
  );
}
