import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import { listTurnosSemana } from "@/lib/db/turnos";
import { listEquipos, listOtros } from "@/lib/db/inventario";
import { listTickets } from "@/lib/db/reparaciones";
import { listClientesOpciones } from "@/lib/db/clientes";
import { getNegocio } from "@/lib/db/configuracion";
import { TurnosClient } from "./turnos-client";

export default async function TurnosPage() {
  const [turnos, equipos, otros, tickets, clientesOpciones, user, negocio] = await Promise.all([
    listTurnosSemana(),
    listEquipos(),
    listOtros(),
    listTickets(),
    listClientesOpciones(),
    requireUser(),
    getNegocio(),
  ]);

  return (
    <Section title="Turnos">
      <TurnosClient
        initialTurnos={turnos}
        initialEquipos={equipos}
        initialOtros={otros}
        ticketsListos={tickets.filter((t) => t.estado === "listo")}
        clientesOpciones={clientesOpciones}
        user={user}
        negocio={negocio}
      />
    </Section>
  );
}
