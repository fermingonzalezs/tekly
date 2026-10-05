import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import { listClientesOpciones } from "@/lib/db/clientes";
import { listEquipos, listOtros, listRepuestos } from "@/lib/db/inventario";
import { listServicios } from "@/lib/db/reparaciones";
import {
  contarItemsVendidos,
  contarVentas,
  getVenta,
  graficosVentas,
  listItemsVendidosPagina,
  listVendedores,
  listVentasPagina,
  resumenVentas,
} from "@/lib/db/ventas";
import { listCajas } from "@/lib/db/cajas";
import { getNegocio } from "@/lib/db/configuracion";
import { contextoPeriodo, periodoAnterior } from "@/lib/date-presets";
import {
  deltaHintDe,
  parseFiltrosVentas,
  rangoDe,
  type SearchParamsInput,
} from "@/lib/ventas-filtros";
import { VentasClient } from "./ventas-client";

export default async function VentasPage({
  searchParams,
}: {
  searchParams: SearchParamsInput;
}) {
  const user = await requireUser();
  const puedeVerCosto = user.rol !== "vendedor";
  const filtros = parseFiltrosVentas(searchParams, { puedeVerCosto });
  const rango = rangoDe(filtros);
  const rangoAnterior = periodoAnterior(filtros.preset, rango);
  const openId = typeof searchParams.open === "string" ? searchParams.open : null;

  const [
    pagina,
    itemsPagina,
    totalVentas,
    totalItems,
    resumen,
    resumenAnterior,
    graficos,
    vendedores,
    clientesOpciones,
    equipos,
    otros,
    servicios,
    repuestos,
    cajas,
    negocio,
    ventaAbierta,
  ] = await Promise.all([
    filtros.vista === "ventas"
      ? listVentasPagina(filtros)
      : Promise.resolve({ ventas: [], total: 0 }),
    filtros.vista === "items"
      ? listItemsVendidosPagina(filtros)
      : Promise.resolve({ items: [], total: 0 }),
    contarVentas(filtros),
    contarItemsVendidos(filtros),
    resumenVentas(filtros),
    rangoAnterior
      ? resumenVentas({
          ...filtros,
          preset: "personalizado",
          desde: rangoAnterior.desde,
          hasta: rangoAnterior.hasta,
        })
      : Promise.resolve(null),
    graficosVentas(filtros),
    listVendedores(),
    listClientesOpciones(),
    listEquipos(),
    listOtros(),
    listServicios(),
    listRepuestos(),
    listCajas(),
    getNegocio(),
    openId ? getVenta(openId) : Promise.resolve(null),
  ]);

  return (
    <Section title="Ventas" ayuda="ventas">
      <VentasClient
        filtros={filtros}
        contexto={contextoPeriodo(filtros.preset, rango)}
        deltaHint={deltaHintDe(filtros.preset)}
        resumen={resumen}
        resumenAnterior={resumenAnterior}
        graficos={graficos}
        ventas={pagina.ventas}
        totalVentas={totalVentas}
        items={itemsPagina.items}
        totalItems={totalItems}
        openId={openId}
        ventaAbierta={ventaAbierta}
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
