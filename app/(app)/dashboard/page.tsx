import { requireUser } from "@/lib/auth";
import { listVentas } from "@/lib/db/ventas";
import { listTickets } from "@/lib/db/reparaciones";
import { listTurnosSemana } from "@/lib/db/turnos";
import { getNegocio, pasosOnboardingDesdeDatos } from "@/lib/db/configuracion";
import { combinarPasosOnboarding, onboardingCompleto } from "@/lib/onboarding";
import {
  agendaDelLocal,
  mesDashboard,
  metricasDashboard,
  metricasEmpleado,
  objetivoDelMes,
  ritmoDelMes,
  ticketsDeTecnico,
  ventaGananciaPorPeriodo,
  ventasPorRubro,
  ventasRecientes,
} from "@/lib/dashboard";
import { DashboardAdmin } from "./dashboard-admin";
import { DashboardEmpleado } from "./dashboard-empleado";
import { Bienvenida } from "@/components/dashboard/bienvenida";
import { tieneRol } from "@/lib/roles";
import type { DashPeriodo } from "@/lib/mock-data";

/** La ramificación por rol vive acá, en el server, a propósito (regla de
 * oro del plan 005): al empleado no se le calcula ni se le pasa ninguna
 * ganancia/margen/costo ni el objetivo de facturación de la org -- lo que
 * no viaja en el payload RSC no se puede leer desde DevTools. */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes: mesParam } = await searchParams;
  const [user, ventas, tickets, turnos, negocio] = await Promise.all([
    requireUser(),
    listVentas(),
    listTickets(),
    listTurnosSemana(),
    getNegocio(),
  ]);

  if (tieneRol(user, "admin") && ventas.length === 0) {
    const pasos = combinarPasosOnboarding(
      negocio.onboardingPasos,
      await pasosOnboardingDesdeDatos(negocio),
    );
    if (!onboardingCompleto(pasos)) {
      return <Bienvenida negocio={{ ...negocio, onboardingPasos: pasos }} />;
    }
  }

  const hoy = new Date();

  if (!tieneRol(user, "admin")) {
    // Empleado: puede ser vendedor, técnico o ambos (plan 029). Las métricas
    // y los bloques son la unión; nada de ganancia/margen viaja al cliente.
    const roles = user.roles.filter(
      (r): r is "vendedor" | "tecnico" => r !== "admin",
    );
    const esVendedor = roles.includes("vendedor");
    const esTecnico = roles.includes("tecnico");

    const metrics = metricasEmpleado({
      ventas,
      tickets,
      turnos,
      userId: user.id,
      roles,
      hoy,
    });

    const misTickets = esTecnico ? ticketsDeTecnico(tickets, user.id) : undefined;

    // Vendedor: solo SUS ventas -- nada de ganancia/margen viaja al cliente.
    let trendByPeriodo: Record<DashPeriodo, { venta: number[]; fechas: string[] }> | undefined;
    let rubroMix: Record<DashPeriodo, { label: string; value: number }[]> | undefined;
    let recentSales: ReturnType<typeof ventasRecientes> | undefined;
    if (esVendedor) {
      const misVentas = ventas.filter((v) => v.vendedorId === user.id);
      const trendCompleto = ventaGananciaPorPeriodo(misVentas, hoy);
      trendByPeriodo = Object.fromEntries(
        Object.entries(trendCompleto).map(([p, t]) => [
          p,
          { venta: t.venta, fechas: t.fechas },
        ]),
      ) as Record<DashPeriodo, { venta: number[]; fechas: string[] }>;
      rubroMix = ventasPorRubro(misVentas, hoy);
      recentSales = ventasRecientes(misVentas, 6, hoy);
    }

    return (
      <DashboardEmpleado
        roles={roles}
        metrics={metrics}
        trendByPeriodo={trendByPeriodo}
        rubroMix={rubroMix}
        recentSales={recentSales}
        misTickets={misTickets}
        turnos={turnos}
      />
    );
  }

  // Admin
  const mes = mesDashboard(mesParam, hoy);
  const agenda = agendaDelLocal(tickets, turnos, hoy);

  return (
    <DashboardAdmin
      metrics={metricasDashboard({ ventas, ticketsAbiertos: agenda.ticketsAbiertos, turnosHoy: agenda.turnosHoy, hoy: mes.ref })}
      objetivo={objetivoDelMes(ventas, mes.ref)}
      objetivoTarget={negocio.objetivoMesUsd}
      ritmo={ritmoDelMes(ventas, mes.ref, hoy)}
      rubros={ventasPorRubro(ventas, mes.ref).mes}
      mes={mes}
      recentSales={ventasRecientes(ventas, 6, hoy)}
      agenda={agenda}
    />
  );
}
