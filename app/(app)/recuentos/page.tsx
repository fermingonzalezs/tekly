import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import { listRecuentos, listMovimientosStock } from "@/lib/db/inventario";
import { RecuentosClient } from "./recuentos-client";

export default async function RecuentosPage() {
  const [recuentos, movimientos, user] = await Promise.all([
    listRecuentos(),
    listMovimientosStock(),
    requireUser(),
  ]);

  return (
    <Section title="Recuentos">
      <RecuentosClient initialRecuentos={recuentos} initialMovimientos={movimientos} user={user} />
    </Section>
  );
}
