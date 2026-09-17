import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import { listEquipos, listRepuestos, listOtros } from "@/lib/db/inventario";
import { InventarioClient } from "./inventario-client";

export default async function InventarioPage() {
  const [equipos, repuestos, otros, user] = await Promise.all([
    listEquipos(),
    listRepuestos(),
    listOtros(),
    requireUser(),
  ]);

  return (
    <Section title="Inventario">
      <InventarioClient
        initialEquipos={equipos}
        initialRepuestos={repuestos}
        initialOtros={otros}
        user={user}
      />
    </Section>
  );
}
