import { requireUser } from "@/lib/auth";
import { listVentas } from "@/lib/db/ventas";
import { listTickets } from "@/lib/db/reparaciones";
import { listTurnosSemana } from "@/lib/db/turnos";
import { getNegocio } from "@/lib/db/configuracion";
import { onboardingCompleto } from "@/lib/onboarding";
import {
  metricasDashboard,
  metricasEmpleado,
  objetivoDelMes,
  ticketsDeTecnico,
  ventaGananciaPorPeriodo,
  ventasPorRubro,
  ventasRecientes,
} from "@/lib/dashboard";
import { DashboardAdmin } from "./dashboard-admin";
import { DashboardEmpleado } from "./dashboard-empleado";
import { Bienvenida } from "@/components/dashboard/bienvenida";
import type { DashPeriodo } from "@/lib/mock-data";

/** La ramificación por rol vive acá, en el server, a propósito (regla de
 * oro del plan 005): al empleado no se le calcula ni se le pasa ninguna
 * ganancia/margen/costo ni el objetivo de facturación de la org -- lo que
 * no viaja en el payload RSC no se puede leer desde DevTools. */
export default async function DashboardPage() {
  const [user, ventas, tickets, turnos, negocio] = await Promise.all([
    requireUser(),
    listVentas(),
    listTickets(),
    listTurnosSemana(),
    getNegocio(),
  ]);

  if (user.rol === "admin" && ventas.length === 0 && !onboardingCompleto(negocio.onboardingPasos)) {
    return <Bienvenida negocio={negocio} />;
  }

  const hoy = new Date();

  if (user.rol !== "admin") {
    const rol = user.rol; // "vendedor" | "tecnico"
    const metrics = metricasEmpleado({
      ventas,
      tickets,
      turnos,
      userId: user.id,
      rol,
      hoy,
    });

    if (rol === "tecnico") {
      return (
        <DashboardEmpleado
          rol={rol}
          metrics={metrics}
          misTickets={ticketsDeTecnico(tickets, user.id)}
          turnos={turnos}
        />
      );
    }

    // Vendedor: solo SUS ventas -- nada de ganancia/margen viaja al cliente.
    const misVentas = ventas.filter((v) => v.vendedorId === user.id);
    const trendCompleto = ventaGananciaPorPeriodo(misVentas, hoy);
    const trendSinGanancia = Object.fromEntries(
      Object.entries(trendCompleto).map(([p, t]) => [
        p,
        { venta: t.venta, fechas: t.fechas },
      ]),
    ) as Record<DashPeriodo, { venta: number[]; fechas: string[] }>;

    return (
      <DashboardEmpleado
        rol={rol}
        metrics={metrics}
        trendByPeriodo={trendSinGanancia}
        rubroMix={ventasPorRubro(misVentas, hoy)}
        recentSales={ventasRecientes(misVentas, 6, hoy)}
        turnos={turnos}
      />
    );
  }

  // Admin
  const turnosHoy = turnos.filter((t) => t.dayOffset === 0 && t.estado !== "cancelado").length;
  const ticketsAbiertos = tickets.filter((t) => t.estado !== "entregado").length;

  return (
    <DashboardAdmin
      metrics={metricasDashboard({ ventas, ticketsAbiertos, turnosHoy, hoy })}
      objetivo={objetivoDelMes(ventas, hoy)}
      objetivoTarget={negocio.objetivoMesUsd}
      trendByPeriodo={ventaGananciaPorPeriodo(ventas, hoy)}
      rubrosPorPeriodo={ventasPorRubro(ventas, hoy)}
      recentSales={ventasRecientes(ventas, 6, hoy)}
      turnos={turnos}
    />
  );
}
