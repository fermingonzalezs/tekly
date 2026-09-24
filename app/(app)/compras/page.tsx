import { Section } from "@/components/section";
import { requireRole } from "@/lib/auth";
import { listCompras } from "@/lib/db/compras";
import { getNegocio } from "@/lib/db/configuracion";
import { ComprasClient } from "./compras-client";

// Compras no es una sección para vendedores: expone precios de compra --
// mismo criterio que Cajas/Analíticas/Cuentas corrientes.
export default async function ComprasPage() {
  const user = await requireRole("admin", "tecnico");
  const [compras, negocio] = await Promise.all([listCompras(), getNegocio()]);

  return (
    <Section title="Compras">
      <ComprasClient initialCompras={compras} user={user} negocio={negocio} />
    </Section>
  );
}
