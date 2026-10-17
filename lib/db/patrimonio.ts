import "server-only";
import { listCajas, listMovimientos } from "@/lib/db/cajas";
import { listMovimientosCC } from "@/lib/db/cuentas-corrientes";
import { listClientes } from "@/lib/db/clientes";
import { listCelulares, listOtros, listRepuestos } from "@/lib/db/inventario";
import { listNotebooks } from "@/lib/db/notebooks";
import { listCompras } from "@/lib/db/compras";
import { listTickets } from "@/lib/db/reparaciones";
import { getDolarServer, type DolarServer } from "@/lib/dolar-server";
import { armarPatrimonio, type Patrimonio } from "@/lib/patrimonio";

/** Datos de `/patrimonio`: trae todas las listas que necesita el balance en
 *  paralelo, pide la cotización de hoy en el server y llama a la lógica pura.
 *
 *  Nota de escala: `listMovimientos()` trae **todos** los movimientos de caja
 *  de la organización para calcular el saldo por caja en JS. Para una org con
 *  mucho historial conviene una RPC/SQL que devuelva el saldo agregado por
 *  caja; no es un problema de la fase 1 (foto de hoy) pero queda anotado. */

export type PatrimonioData = {
  patrimonio: Patrimonio;
  dolar: DolarServer;
};

export async function getPatrimonio(): Promise<PatrimonioData> {
  const [
    dolar,
    cajas,
    movimientos,
    movimientosCC,
    clientes,
    celulares,
    notebooks,
    repuestos,
    otros,
    compras,
    tickets,
  ] = await Promise.all([
    getDolarServer(),
    listCajas(),
    listMovimientos(),
    listMovimientosCC(),
    listClientes(),
    listCelulares(),
    listNotebooks(),
    listRepuestos(),
    listOtros(),
    listCompras(),
    listTickets(),
  ]);

  const patrimonio = armarPatrimonio({
    cotizacion: dolar.venta,
    cajas,
    movimientos,
    movimientosCC,
    clientes,
    celulares,
    notebooks,
    repuestos,
    otros,
    compras,
    tickets,
  });

  return { patrimonio, dolar };
}
