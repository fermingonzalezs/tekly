import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import {
  listCelulares,
  listRepuestos,
  listOtros,
  listMovimientosStockBulk,
} from "@/lib/db/inventario";
import { listNotebooks } from "@/lib/db/notebooks";
import { hoyISO } from "@/lib/date-presets";
import { InventarioClient } from "./inventario-client";

export default async function InventarioPage() {
  const [celulares, notebooks, repuestos, otros, movimientos, user] =
    await Promise.all([
      listCelulares(),
      listNotebooks(),
      listRepuestos(),
      listOtros(),
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
        movimientos={movimientos}
        hoy={hoyISO()}
        user={user}
      />
    </Section>
  );
}
