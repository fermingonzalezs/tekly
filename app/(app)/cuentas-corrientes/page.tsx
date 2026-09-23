import { Section } from "@/components/section";
import { requireRole } from "@/lib/auth";
import { listMovimientosCC } from "@/lib/db/cuentas-corrientes";
import { listClientesOpciones } from "@/lib/db/clientes";
import { CuentasCorrientesClient } from "./cuentas-corrientes-client";

// Financiero -- no es una sección para vendedores.
export default async function CuentasCorrientesPage() {
  const user = await requireRole("admin", "tecnico");
  const [movimientos, clientes] = await Promise.all([
    listMovimientosCC(),
    listClientesOpciones(),
  ]);

  return (
    <Section title="Cuentas corrientes">
      <CuentasCorrientesClient
        initialMovimientos={movimientos}
        clientes={clientes}
        usuarioNombre={user.nombre}
        user={user}
      />
    </Section>
  );
}
