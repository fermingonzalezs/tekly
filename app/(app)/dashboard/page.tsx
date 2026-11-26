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
  ventasPorRubro,
  ventasRecientes,
} from "@/lib/dashboard";
import { DashboardAdmin } from "./dashboard-admin";
import { DashboardEmpleado, type MisVentasDashboard } from "./dashboard-empleado";
import { Bienvenida } from "@/components/dashboard/bienvenida";
import { tieneRol } from "@/lib/roles";

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
      hoy,
    });

    const misTickets = esTecnico ? ticketsDeTecnico(tickets, user.id) : undefined;

    // Siempre el mes en curso (sin navegador de meses). Vendedor: solo SUS
    // ventas, sin ganancia/margen ni la meta de la org (el ritmo va sin meta).
    const mesActual = mesDashboard(undefined, hoy);
    let misVentas: MisVentasDashboard | undefined;
    if (esVendedor) {
      const mias = ventas.filter((v) => v.vendedorId === user.id);
      misVentas = {
        ritmo: ritmoDelMes(mias, mesActual.ref, hoy),
        rubros: ventasPorRubro(mias, mesActual.ref).mes,
        totalMes: objetivoDelMes(mias, mesActual.ref).current,
        recientes: ventasRecientes(mias, 6, hoy),
      };
    }

    return (
      <DashboardEmpleado
        roles={roles}
        metrics={metrics}
        mes={mesActual}
        agenda={agendaDelLocal(tickets, turnos, hoy)}
        misVentas={misVentas}
        misTickets={misTickets}
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
