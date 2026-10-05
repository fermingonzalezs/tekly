import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import {
  listEquipos,
  listRepuestos,
  listOtros,
  listMovimientosStockBulk,
} from "@/lib/db/inventario";
import { hoyISO } from "@/lib/date-presets";
import { InventarioClient } from "./inventario-client";

export default async function InventarioPage() {
  const [equipos, repuestos, otros, movimientos, user] = await Promise.all([
    listEquipos(),
    listRepuestos(),
    listOtros(),
    listMovimientosStockBulk(),
    requireUser(),
  ]);

  return (
    <Section title="Inventario" ayuda="inventario">
      <InventarioClient
        initialEquipos={equipos}
        initialRepuestos={repuestos}
        initialOtros={otros}
        movimientos={movimientos}
        hoy={hoyISO()}
        user={user}
      />
    </Section>
  );
}
