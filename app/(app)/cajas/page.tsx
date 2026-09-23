import { Section } from "@/components/section";
import { requireRole } from "@/lib/auth";
import { listCajas, listConciliaciones, listMovimientos } from "@/lib/db/cajas";
import { CajasClient } from "./cajas-client";

// Financiero -- no es una sección para vendedores.
export default async function CajasPage() {
  const user = await requireRole("admin", "tecnico");
  const [cajas, movimientosSinConciliar, movimientosTodos, conciliaciones] = await Promise.all([
    listCajas(),
    listMovimientos({ soloSinConciliar: true }),
    listMovimientos(),
    listConciliaciones(),
  ]);

  return (
    <Section title="Cajas">
      <CajasClient
        initialCajas={cajas}
        initialMovimientosSinConciliar={movimientosSinConciliar}
        initialMovimientosTodos={movimientosTodos}
        initialConciliaciones={conciliaciones}
        usuarioNombre={user.nombre}
        user={user}
      />
    </Section>
  );
}
