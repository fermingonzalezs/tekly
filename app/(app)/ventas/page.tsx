import type { ResumenVentas } from "@/lib/ventas";
import { Section } from "@/components/section";
import { listTiendas } from "@/lib/db/tiendas";
import { requireUser } from "@/lib/auth";
import { listClientesOpciones } from "@/lib/db/clientes";
import { listCelulares, listOtros, listRepuestos } from "@/lib/db/inventario";
import { listNotebooks } from "@/lib/db/notebooks";
import { listServicios } from "@/lib/db/reparaciones";
import {
  contarItemsVendidos,
  contarVentas,
  getVenta,
  graficosVentas,
  listItemsVendidosPagina,
  listVendedores,
  listUsuariosVenta,
  listVentasPagina,
  resumenVentas,
} from "@/lib/db/ventas";
import { listCajas } from "@/lib/db/cajas";
import { getNegocio } from "@/lib/db/configuracion";
import { listVariantes } from "@/lib/db/variantes";
import { contextoPeriodo, periodoAnterior } from "@/lib/date-presets";
import {
  deltaHintDe,
  parseFiltrosVentas,
  rangoDe,
  type SearchParamsInput,
} from "@/lib/ventas-filtros";
import { VentasClient } from "./ventas-client";

export default async function VentasPage(
  props: {
    searchParams: Promise<SearchParamsInput>;
  }
) {
  const searchParams = await props.searchParams;
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
    usuariosVenta,
    tiendas,
    clientesOpciones,
    celulares,
    notebooks,
    otros,
    servicios,
    repuestos,
    cajas,
    negocio,
    ventaAbierta,
    variantes,
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
    listUsuariosVenta(),
    listTiendas(),
    listClientesOpciones(),
    listCelulares(),
    listNotebooks(),
    listOtros(),
    listServicios(),
    listRepuestos(),
    listCajas(),
    getNegocio(),
    openId ? getVenta(openId) : Promise.resolve(null),
    listVariantes({ categoria: "todas" }),
  ]);

  // Al vendedor no le viaja ni la ganancia ni el margen (se lee del payload).
  const sinCostos = (r: ResumenVentas): ResumenVentas =>
    puedeVerCosto ? r : { ...r, margenPct: null, gananciaUsd: null };

  return (
    <Section title="Ventas" ayuda="ventas">
      <VentasClient
        filtros={filtros}
        contexto={contextoPeriodo(filtros.preset, rango)}
        deltaHint={deltaHintDe(filtros.preset)}
        resumen={sinCostos(resumen)}
        resumenAnterior={resumenAnterior && sinCostos(resumenAnterior)}
        graficos={graficos}
        ventas={pagina.ventas}
        totalVentas={totalVentas}
        items={itemsPagina.items}
        totalItems={totalItems}
        openId={openId}
        ventaAbierta={ventaAbierta}
        clientesOpciones={clientesOpciones}
        celulares={celulares}
        notebooks={notebooks}
        otros={otros}
        servicios={servicios}
        repuestos={repuestos}
        vendedores={vendedores}
        usuariosVenta={usuariosVenta}
        tiendas={tiendas}
        cajas={cajas}
        negocio={negocio}
        variantes={variantes}
        user={user}
      />
    </Section>
  );
}
