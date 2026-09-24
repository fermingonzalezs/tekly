import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import { listClientesOpciones } from "@/lib/db/clientes";
import { listCajas } from "@/lib/db/cajas";
import { listRepuestos } from "@/lib/db/inventario";
import { listServicios, listTecnicos, listTickets } from "@/lib/db/reparaciones";
import { getNegocio } from "@/lib/db/configuracion";
import { ReparacionesClient } from "./reparaciones-client";

export default async function ReparacionesPage() {
  const [tickets, servicios, repuestos, tecnicos, clientesOpciones, cajas, negocio, user] =
    await Promise.all([
      listTickets(),
      listServicios(),
      listRepuestos(),
      listTecnicos(),
      listClientesOpciones(),
      listCajas(),
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
        cajas={cajas}
        negocio={negocio}
        user={user}
      />
    </Section>
  );
}
