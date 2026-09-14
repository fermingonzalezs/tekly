import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import { listTurnosSemana } from "@/lib/db/turnos";
import { listEquipos } from "@/lib/db/inventario";
import { TurnosClient } from "./turnos-client";

export default async function TurnosPage() {
  const [turnos, equipos, user] = await Promise.all([
    listTurnosSemana(),
    listEquipos(),
    requireUser(),
  ]);

  return (
    <Section title="Turnos">
      <TurnosClient initialTurnos={turnos} initialEquipos={equipos} user={user} />
    </Section>
  );
}
