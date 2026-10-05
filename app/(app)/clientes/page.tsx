import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import { DemografiaClientes } from "@/components/clientes/demografia";
import { FuenteClientes } from "@/components/clientes/fuente-clientes";
import { listClientes, demografiaClientes } from "@/lib/db/clientes";
import { listVentas } from "@/lib/db/ventas";
import { listTickets } from "@/lib/db/reparaciones";
import { clientesIntel, kpisClientes } from "@/lib/clientes-inteligencia";
import { ClientesClient } from "./clientes-client";

export default async function ClientesPage() {
  const [clientes, demografia, user, ventas, tickets] = await Promise.all([
    listClientes(),
    demografiaClientes(),
    requireUser(),
    listVentas(),
    listTickets(),
  ]);

  const hoy = new Date();
  const intel = clientesIntel(clientes, ventas, tickets, hoy);
  const kpis = kpisClientes(intel, hoy);

  return (
    <Section title="Clientes" ayuda="clientes">
      <ClientesClient
        initialClientes={clientes}
        kpis={kpis}
        user={user}
        graficos={
          <>
            <DemografiaClientes data={demografia} />
            <FuenteClientes />
          </>
        }
      />
    </Section>
  );
}
