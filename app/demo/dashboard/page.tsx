"use client";

import { useMemo, useState } from "react";
import { DashboardAdmin } from "@/app/(app)/dashboard/dashboard-admin";
import { useDemo } from "@/lib/demo/store";
import {
  agendaDelLocal,
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

  const agenda = agendaDelLocal(state.tickets, state.turnos, hoy);

  return (
    <DashboardAdmin
      metrics={metricasDashboard({
        ventas: state.ventas,
        ticketsAbiertos: agenda.ticketsAbiertos,
        turnosHoy: agenda.turnosHoy,
        hoy: mes.ref,
      })}
      objetivo={objetivoDelMes(state.ventas, mes.ref)}
      objetivoTarget={state.negocio.objetivoMesUsd}
      ritmo={ritmoDelMes(state.ventas, mes.ref, hoy)}
      rubros={ventasPorRubro(state.ventas, mes.ref).mes}
      mes={mes}
      onMesChange={setClaveMes}
      recentSales={ventasRecientes(state.ventas, 6, hoy)}
      agenda={agenda}
      ventasHref="/demo/ventas"
      demo
    />
  );
}
