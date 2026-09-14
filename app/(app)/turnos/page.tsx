import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import { listTurnosSemana } from "@/lib/db/turnos";
import { listEquipos } from "@/lib/db/inventario";
import { listClientesOpciones } from "@/lib/db/clientes";
import { TurnosClient } from "./turnos-client";

export default async function TurnosPage() {
  const [turnos, equipos, clientesOpciones, user] = await Promise.all([
    listTurnosSemana(),
    listEquipos(),
    listClientesOpciones(),
    requireUser(),
  ]);

  return (
    <Section title="Turnos">
      <TurnosClient
        initialTurnos={turnos}
        initialEquipos={equipos}
        clientesOpciones={clientesOpciones}
        user={user}
      />
    </Section>
  );
}
