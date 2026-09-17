import { listVentas } from "@/lib/db/ventas";
import { listEquipos, listRepuestos, listOtros } from "@/lib/db/inventario";
import { listClientes, demografiaClientes } from "@/lib/db/clientes";
import { listTurnosSemana } from "@/lib/db/turnos";
import { listCajas, listMovimientos } from "@/lib/db/cajas";
import { ventasPorMes, facturacionDiaria, margenPorTipo, ventasPorRubroMes } from "@/lib/analiticas";
import { FuenteClientes } from "@/components/clientes/fuente-clientes";
import { AnaliticasClient } from "./analiticas-client";

export default async function AnaliticasPage() {
  const [ventas, equipos, repuestos, otros, clientes, turnos, cajas, movimientosTodos, demografia] =
    await Promise.all([
      listVentas(),
      listEquipos(),
      listRepuestos(),
      listOtros(),
      listClientes(),
      listTurnosSemana(),
      listCajas(),
      listMovimientos(),
      demografiaClientes(),
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
      ventasPorMes={ventasPorMes(ventas)}
      salesTrend={facturacionDiaria(ventas)}
      margenPorTipo={margenPorTipo(ventas)}
      rubroMesData={ventasPorRubroMes(ventas)}
      demografia={demografia}
      fuenteClientes={<FuenteClientes />}
    />
  );
}
