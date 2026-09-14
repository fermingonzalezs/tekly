import { Section } from "@/components/section";
import { listEquipos, listRepuestos, listOtros } from "@/lib/db/inventario";
import { InventarioClient } from "./inventario-client";

export default async function InventarioPage() {
  const [equipos, repuestos, otros] = await Promise.all([
    listEquipos(),
    listRepuestos(),
    listOtros(),
  ]);

  return (
    <Section title="Inventario">
      <InventarioClient
        initialEquipos={equipos}
        initialRepuestos={repuestos}
        initialOtros={otros}
      />
    </Section>
  );
}
