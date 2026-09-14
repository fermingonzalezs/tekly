import { Section } from "@/components/section";
import { DemografiaClientes } from "@/components/clientes/demografia";
import { FuenteClientes } from "@/components/clientes/fuente-clientes";
import { listClientes } from "@/lib/db/clientes";
import { ClientesClient } from "./clientes-client";

export default async function ClientesPage() {
  const clientes = await listClientes();

  return (
    <Section title="Clientes">
      <ClientesClient
        initialClientes={clientes}
        charts={
          <div className="grid gap-5 xl:grid-cols-2">
            <DemografiaClientes />
            <FuenteClientes />
          </div>
        }
      />
    </Section>
  );
}
