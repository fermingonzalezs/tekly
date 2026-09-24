import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import { listClientesOpciones } from "@/lib/db/clientes";
import { listRepuestos } from "@/lib/db/inventario";
import { listServicios, listTecnicos, listTickets } from "@/lib/db/reparaciones";
import { getNegocio } from "@/lib/db/configuracion";
import { ReparacionesClient } from "./reparaciones-client";

export default async function ReparacionesPage() {
  const [tickets, servicios, repuestos, tecnicos, clientesOpciones, negocio, user] =
    await Promise.all([
      listTickets(),
      listServicios(),
      listRepuestos(),
      listTecnicos(),
      listClientesOpciones(),
      getNegocio(),
      requireUser(),
    ]);

  return (
    <Section title="Reparaciones">
      <ReparacionesClient
        initialTickets={tickets}
        initialServicios={servicios}
        repuestos={repuestos}
        tecnicos={tecnicos}
        clientesOpciones={clientesOpciones}
        negocio={negocio}
        user={user}
      />
    </Section>
  );
}
