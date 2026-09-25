import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import { listTurnosSemana } from "@/lib/db/turnos";
import { listEquipos } from "@/lib/db/inventario";
import { listClientesOpciones } from "@/lib/db/clientes";
import { getNegocio } from "@/lib/db/configuracion";
import { TurnosClient } from "./turnos-client";

export default async function TurnosPage() {
  const [turnos, equipos, clientesOpciones, user, negocio] = await Promise.all([
    listTurnosSemana(),
    listEquipos(),
    listClientesOpciones(),
    requireUser(),
    getNegocio(),
  ]);

  return (
    <Section title="Turnos">
      <TurnosClient
        initialTurnos={turnos}
        initialEquipos={equipos}
        clientesOpciones={clientesOpciones}
        user={user}
        negocio={negocio}
      />
    </Section>
  );
}
