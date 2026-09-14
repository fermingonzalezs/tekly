import { listVentas } from "@/lib/db/ventas";
import { listEquipos } from "@/lib/db/inventario";
import { listTickets } from "@/lib/db/reparaciones";
import { listTurnosSemana } from "@/lib/db/turnos";
import {
  metricasDashboard,
  objetivoDelMes,
  ventaGananciaPorPeriodo,
  ventasRecientes,
} from "@/lib/dashboard";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const [ventas, equipos, tickets, turnos] = await Promise.all([
    listVentas(),
    listEquipos(),
    listTickets(),
    listTurnosSemana(),
  ]);

  const turnosHoy = turnos.filter((t) => t.dayOffset === 0 && t.estado !== "cancelado").length;
  const ticketsAbiertos = tickets.filter((t) => t.estado !== "entregado").length;
  const equiposEnRevision = equipos.filter((e) => e.estado === "en_revision").length;

  const metrics = metricasDashboard({ ventas, ticketsAbiertos, equiposEnRevision, turnosHoy });
  const objetivo = objetivoDelMes(ventas);
  const trendByPeriodo = ventaGananciaPorPeriodo(ventas);
  const recentSales = ventasRecientes(ventas);

  return (
    <DashboardClient
      metrics={metrics}
      objetivo={objetivo}
      trendByPeriodo={trendByPeriodo}
      recentSales={recentSales}
      turnos={turnos}
    />
  );
}
