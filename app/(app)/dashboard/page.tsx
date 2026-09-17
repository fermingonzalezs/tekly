import { listVentas } from "@/lib/db/ventas";
import { listTickets } from "@/lib/db/reparaciones";
import { listTurnosSemana } from "@/lib/db/turnos";
import { getNegocio } from "@/lib/db/configuracion";
import {
  metricasDashboard,
  objetivoDelMes,
  ventaGananciaPorPeriodo,
  ventasPorRubro,
  ventasRecientes,
} from "@/lib/dashboard";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const [ventas, tickets, turnos, negocio] = await Promise.all([
    listVentas(),
    listTickets(),
    listTurnosSemana(),
    getNegocio(),
  ]);

  const turnosHoy = turnos.filter((t) => t.dayOffset === 0 && t.estado !== "cancelado").length;
  const ticketsAbiertos = tickets.filter((t) => t.estado !== "entregado").length;

  const metrics = metricasDashboard({ ventas, ticketsAbiertos, turnosHoy });
  const objetivo = objetivoDelMes(ventas);
  const trendByPeriodo = ventaGananciaPorPeriodo(ventas);
  const rubrosPorPeriodo = ventasPorRubro(ventas);
  const recentSales = ventasRecientes(ventas);

  return (
    <DashboardClient
      metrics={metrics}
      objetivo={objetivo}
      objetivoTarget={negocio.objetivoMesUsd}
      trendByPeriodo={trendByPeriodo}
      rubrosPorPeriodo={rubrosPorPeriodo}
      recentSales={recentSales}
      turnos={turnos}
    />
  );
}
