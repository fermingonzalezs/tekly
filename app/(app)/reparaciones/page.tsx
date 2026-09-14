import { Section } from "@/components/section";
import { listClientesOpciones } from "@/lib/db/clientes";
import { listServicios, listTecnicos, listTickets } from "@/lib/db/reparaciones";
import { getNegocio } from "@/lib/db/configuracion";
import { ReparacionesClient } from "./reparaciones-client";

export default async function ReparacionesPage() {
  const [tickets, servicios, tecnicos, clientesOpciones, negocio] = await Promise.all([
    listTickets(),
    listServicios(),
    listTecnicos(),
    listClientesOpciones(),
    getNegocio(),
  ]);

  return (
    <Section title="Reparaciones">
      <ReparacionesClient
        initialTickets={tickets}
        initialServicios={servicios}
        tecnicos={tecnicos}
        clientesOpciones={clientesOpciones}
        negocio={negocio}
      />
    </Section>
  );
}
