import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import { DemografiaClientes } from "@/components/clientes/demografia";
import { FuenteClientes } from "@/components/clientes/fuente-clientes";
import { listClientes, demografiaClientes } from "@/lib/db/clientes";
import { ClientesClient } from "./clientes-client";

export default async function ClientesPage() {
  const [clientes, demografia, user] = await Promise.all([
    listClientes(),
    demografiaClientes(),
    requireUser(),
  ]);

  return (
    <Section title="Clientes">
      <ClientesClient
        initialClientes={clientes}
        user={user}
        charts={
          <div className="grid gap-5 xl:grid-cols-2">
            <DemografiaClientes data={demografia} />
            <FuenteClientes />
          </div>
        }
      />
    </Section>
  );
}
