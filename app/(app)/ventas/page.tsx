import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import { listClientesOpciones } from "@/lib/db/clientes";
import { listEquipos, listOtros } from "@/lib/db/inventario";
import { listServicios } from "@/lib/db/reparaciones";
import { listVendedores, listVentas } from "@/lib/db/ventas";
import { getNegocio } from "@/lib/db/configuracion";
import { VentasClient } from "./ventas-client";

export default async function VentasPage() {
  const [ventas, clientesOpciones, equipos, otros, servicios, vendedores, negocio, user] =
    await Promise.all([
      listVentas(),
      listClientesOpciones(),
      listEquipos(),
      listOtros(),
      listServicios(),
      listVendedores(),
      getNegocio(),
      requireUser(),
    ]);

  return (
    <Section title="Ventas">
      <VentasClient
        initialVentas={ventas}
        clientesOpciones={clientesOpciones}
        equipos={equipos}
        otros={otros}
        servicios={servicios}
        vendedores={vendedores}
        negocio={negocio}
        user={user}
      />
    </Section>
  );
}
