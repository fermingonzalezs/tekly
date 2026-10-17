"use client";

import { useMemo, useState } from "react";
import { DashboardAdmin } from "@/app/(app)/dashboard/dashboard-admin";
import { useDemo } from "@/lib/demo/store";
import {
  mesDashboard,
  metricasDashboard,
  objetivoDelMes,
  ritmoDelMes,
  ventasPorRubro,
  ventasRecientes,
} from "@/lib/dashboard";

/** Dashboard de la demo (rol admin), calculado sobre el store local. */
export default function DemoDashboardPage() {
  const { state } = useDemo();
  const hoy = useMemo(() => new Date(), []);
  const [claveMes, setClaveMes] = useState<string | null>(null);
  const mes = mesDashboard(claveMes, hoy);

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
        hoy: mes.ref,
      })}
      objetivo={objetivoDelMes(state.ventas, mes.ref)}
      objetivoTarget={state.negocio.objetivoMesUsd}
      ritmo={ritmoDelMes(state.ventas, mes.ref, hoy)}
      rubros={ventasPorRubro(state.ventas, mes.ref).mes}
      mes={mes}
      onMesChange={setClaveMes}
      recentSales={ventasRecientes(state.ventas, 6, hoy)}
      turnos={state.turnos}
      ventasHref="/demo/ventas"
    />
  );
}
