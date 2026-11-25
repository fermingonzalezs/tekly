import { Section } from "@/components/section";
import { requireRole } from "@/lib/auth";
import { listCompras, listIngresos } from "@/lib/db/compras";
import { listCajas } from "@/lib/db/cajas";
import { getNegocio } from "@/lib/db/configuracion";
import { listCelulares, listOtros, listRepuestos } from "@/lib/db/inventario";
import { listNotebooks } from "@/lib/db/notebooks";
import { listVariantes } from "@/lib/db/variantes";
import { ComprasClient } from "./compras-client";

// Compras no es una sección para vendedores: expone precios de compra --
// mismo criterio que Cajas/Analíticas/Cuentas corrientes. Desde el plan 025
// es además la única puerta de entrada al stock («Compras / Ingresos»).
export default async function ComprasPage() {
  const user = await requireRole("admin", "tecnico");
  const [compras, ingresos, negocio, cajas, variantes, celulares, notebooks, repuestos, otros] =
    await Promise.all([
      listCompras(),
      listIngresos(),
      getNegocio(),
      listCajas(),
      listVariantes({ categoria: "todas" }),
      listCelulares(),
      listNotebooks(),
      listRepuestos(),
      listOtros(),
    ]);

  return (
    <Section title="Compras / Ingresos" ayuda="compras">
      <ComprasClient
        initialCompras={compras}
        ingresos={ingresos}
        user={user}
        negocio={negocio}
        cajas={cajas}
        stock={{ variantes, celulares, notebooks, repuestos, otros }}
      />
    </Section>
  );
}
