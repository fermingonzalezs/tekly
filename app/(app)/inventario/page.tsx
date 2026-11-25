import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import {
  listCelulares,
  listRepuestos,
  listOtros,
  listMovimientosStockBulk,
} from "@/lib/db/inventario";
import { listNotebooks } from "@/lib/db/notebooks";
import { listVariantes } from "@/lib/db/variantes";
import { hoyISO } from "@/lib/date-presets";
import { InventarioClient } from "./inventario-client";

export default async function InventarioPage() {
  const [celulares, notebooks, repuestos, otros, variantes, movimientos, user] =
    await Promise.all([
      listCelulares(),
      listNotebooks(),
      listRepuestos(),
      listOtros(),
      listVariantes({ incluirInactivas: true, categoria: "todas" }),
      listMovimientosStockBulk(),
      requireUser(),
    ]);

  return (
    <Section title="Inventario" ayuda="inventario">
      <InventarioClient
        initialCelulares={celulares}
        initialNotebooks={notebooks}
        initialRepuestos={repuestos}
        initialOtros={otros}
        initialVariantes={variantes}
        movimientos={movimientos}
        hoy={hoyISO()}
        user={user}
      />
    </Section>
  );
}
