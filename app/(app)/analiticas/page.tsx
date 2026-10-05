import { requireRole } from "@/lib/auth";
import { listVentas } from "@/lib/db/ventas";
import {
  listEquipos,
  listRepuestos,
  listOtros,
  listMovimientosStockBulk,
} from "@/lib/db/inventario";
import { listClientes } from "@/lib/db/clientes";
import { listTurnosRango } from "@/lib/db/turnos";
import { listCajas, listMovimientos } from "@/lib/db/cajas";
import { listMovimientosCC } from "@/lib/db/cuentas-corrientes";
import { listCompras } from "@/lib/db/compras";
import { listTickets } from "@/lib/db/reparaciones";
import {
  antiguedadTicketsAbiertos,
  type AntiguedadTickets,
} from "@/lib/analiticas";
import {
  resumenClientes,
  resumenFinanzas,
  resumenInventario,
  resumenReparaciones,
  resumenTurnos,
  resumenVentas,
  type ContextoAnaliticas,
  type ResumenClientes,
  type ResumenFinanzas,
  type ResumenInventario,
  type ResumenReparaciones,
  type ResumenTurnos,
  type ResumenVentasAnaliticas,
} from "@/lib/analiticas-resumen";
import { periodoAnterior } from "@/lib/date-presets";
import { hoyISO } from "@/lib/date-presets";
import {
  parseFiltrosAnaliticas,
  rangoDe,
  type SearchParamsInput,
} from "@/lib/analiticas-filtros";
import { AnaliticasClient } from "./analiticas-client";

/** Analíticas = solo admin (márgenes, costos, ganancia). El cálculo va por
 * pestaña acá en el server: al cliente solo le llegan agregados
 * serializables, nunca arrays crudos de la historia (ver plan 008). */
export default async function AnaliticasPage({
  searchParams,
}: {
  searchParams: SearchParamsInput;
}) {
  await requireRole("admin");
  const filtros = parseFiltrosAnaliticas(searchParams);
  const ahora = new Date();
  const rango = rangoDe(filtros, ahora);
  const rangoAnterior = periodoAnterior(filtros.preset, rango);

  const ctx: ContextoAnaliticas = {
    rango,
    rangoAnterior,
    preset: filtros.preset,
    hoy: ahora,
  };

  // Solo se traen y calculan los datos del tab activo.
  let ventas:
    | { tipo: "ventas"; resumen: ResumenVentasAnaliticas }
    | null = null;
  let reparaciones: ResumenReparaciones | null = null;
  let finanzas: ResumenFinanzas | null = null;
  let inventario: ResumenInventario | null = null;
  let clientes: ResumenClientes | null = null;
  let turnos: ResumenTurnos | null = null;
  let antiguedadTickets: AntiguedadTickets[] = [];

  if (filtros.tab === "ventas") {
    const data = await listVentas();
    ventas = { tipo: "ventas", resumen: resumenVentas(data, ctx) };
  } else if (filtros.tab === "reparaciones") {
    const [data, movs, movsCC, cajas, repuestos] = await Promise.all([
      listTickets(),
      listMovimientos(),
      listMovimientosCC(),
      listCajas(),
      listRepuestos(),
    ]);
    antiguedadTickets = antiguedadTicketsAbiertos(data, ctx.hoy);
    reparaciones = resumenReparaciones(data, movs, movsCC, cajas, repuestos, ctx, antiguedadTickets);
  } else if (filtros.tab === "finanzas") {
    const [data, movs, cajas, compras] = await Promise.all([
      listVentas(),
      listMovimientos(),
      listCajas(),
      listCompras(),
    ]);
    finanzas = resumenFinanzas(data, movs, cajas, compras, ctx);
  } else if (filtros.tab === "inventario") {
    const [equipos, repuestos, otros, movsStock, data, tickets] = await Promise.all([
      listEquipos(),
      listRepuestos(),
      listOtros(),
      listMovimientosStockBulk(),
      listVentas(),
      listTickets(),
    ]);
    inventario = resumenInventario(equipos, repuestos, otros, movsStock, data, tickets, ctx);
  } else if (filtros.tab === "clientes") {
    const [dataClientes, dataVentas, dataTickets] = await Promise.all([
      listClientes(),
      listVentas(),
      listTickets(),
    ]);
    clientes = resumenClientes(dataClientes, dataVentas, dataTickets, ctx);
  } else if (filtros.tab === "turnos") {
    const hoyIso = hoyISO(ahora);
    const hasta = rango.hasta && rango.hasta < hoyIso ? rango.hasta : hoyIso;
    const desde = rango.desde || "";
    const data = await listTurnosRango(desde, hasta);
    turnos = resumenTurnos(data);
  }

  return (
    <AnaliticasClient
      filtros={filtros}
      rango={rango}
      rangoAnterior={rangoAnterior}
      ventas={ventas?.resumen ?? null}
      reparaciones={reparaciones}
      finanzas={finanzas}
      inventario={inventario}
      clientes={clientes}
      turnos={turnos}
      antiguedadTickets={antiguedadTickets}
    />
  );
}
