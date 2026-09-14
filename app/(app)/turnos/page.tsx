import { Section } from "@/components/section";
import { listTurnosSemana } from "@/lib/db/turnos";
import { listEquipos } from "@/lib/db/inventario";
import { TurnosClient } from "./turnos-client";

export default async function TurnosPage() {
  const [turnos, equipos] = await Promise.all([
    listTurnosSemana(),
    listEquipos(),
  ]);

  return (
    <Section title="Turnos">
      <TurnosClient initialTurnos={turnos} initialEquipos={equipos} />
    </Section>
  );
}
