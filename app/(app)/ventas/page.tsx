import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import { listClientesOpciones } from "@/lib/db/clientes";
import { listEquipos, listOtros, listRepuestos } from "@/lib/db/inventario";
import { listServicios } from "@/lib/db/reparaciones";
import { listVendedores, listVentas } from "@/lib/db/ventas";
import { listCajas } from "@/lib/db/cajas";
import { getNegocio } from "@/lib/db/configuracion";
import { VentasClient } from "./ventas-client";

export default async function VentasPage() {
  const [
    ventas,
    clientesOpciones,
    equipos,
    otros,
    servicios,
    repuestos,
    vendedores,
    cajas,
    negocio,
    user,
  ] = await Promise.all([
    listVentas(),
    listClientesOpciones(),
    listEquipos(),
    listOtros(),
    listServicios(),
    listRepuestos(),
    listVendedores(),
    listCajas(),
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
        repuestos={repuestos}
        vendedores={vendedores}
        cajas={cajas}
        negocio={negocio}
        user={user}
      />
    </Section>
  );
}
