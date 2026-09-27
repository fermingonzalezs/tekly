import { requireRole } from "@/lib/auth";
import { listVentas } from "@/lib/db/ventas";
import { listEquipos, listRepuestos, listOtros, listMovimientosStockBulk } from "@/lib/db/inventario";
import { listClientes } from "@/lib/db/clientes";
import { listTurnosSemana } from "@/lib/db/turnos";
import { listCajas, listMovimientos } from "@/lib/db/cajas";
import { listCompras } from "@/lib/db/compras";
import { listTickets } from "@/lib/db/reparaciones";
import { facturacionDiaria, ventasPorRubroMes, antiguedadTicketsAbiertos } from "@/lib/analiticas";
import { AnaliticasClient } from "./analiticas-client";

// Financiero -- no es una sección para vendedores.
export default async function AnaliticasPage() {
  await requireRole("admin", "tecnico");
  const [ventas, equipos, repuestos, otros, clientes, turnos, cajas, movimientosTodos, compras, tickets, movimientosStock] =
    await Promise.all([
      listVentas(),
      listEquipos(),
      listRepuestos(),
      listOtros(),
      listClientes(),
      listTurnosSemana(),
      listCajas(),
      listMovimientos(),
      listCompras(),
      listTickets(),
      listMovimientosStockBulk(),
    ]);

  return (
    <AnaliticasClient
      ventas={ventas}
      equipos={equipos}
      repuestos={repuestos}
      otros={otros}
      clientes={clientes}
      turnos={turnos}
      cajas={cajas}
      movimientosTodos={movimientosTodos}
      movimientosStock={movimientosStock}
      compras={compras}
      tickets={tickets}
      salesTrend={facturacionDiaria(ventas)}
      rubroMesData={ventasPorRubroMes(ventas)}
      antiguedadTickets={antiguedadTicketsAbiertos(tickets)}
      hoy={new Date()}
    />
  );
}
