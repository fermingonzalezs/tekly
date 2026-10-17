import { Section } from "@/components/section";
import { requireRole } from "@/lib/auth";
import { getPatrimonio } from "@/lib/db/patrimonio";
import { listSnapshots, registrarSnapshot } from "@/lib/db/patrimonio-snapshots";
import { hoyISO } from "@/lib/date-presets";
import {
  primeraFoto,
  serieMensual,
  variacionVsMesAnterior,
} from "@/lib/patrimonio-historial";
import { PatrimonioClient } from "./patrimonio-client";

/** Cuántos meses de historial se muestran (contando el mes en curso). */
const MESES_HISTORIAL = 12;

/** Primer día del mes más viejo de la ventana (`YYYY-MM-DD`). */
function desdeHistorial(hoy: string): string {
  const d = new Date(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1 - (MESES_HISTORIAL - 1), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// Balance gerencial (caja, créditos, inventario, anticipos) -- información
// sensible de costos y saldos, solo admin (técnico/vendedor no la ven ni por
// URL).
export default async function PatrimonioPage() {
  const user = await requireRole("admin");
  const { patrimonio, dolar } = await getPatrimonio();
  const hoy = hoyISO();

  // Fase 2: cada visita deja la foto del día (la última del día gana) y el
  // historial sale de esas fotos. Si no se puede guardar (cuenta en solo
  // lectura) la página sigue andando con lo que ya había.
  await registrarSnapshot(user.organizationId, patrimonio, hoy);
  let snapshots: Awaited<ReturnType<typeof listSnapshots>> = [];
  try {
    snapshots = await listSnapshots(desdeHistorial(hoy));
  } catch {
    snapshots = [];
  }

  const actual = {
    activoUsd: patrimonio.activo.total,
    pasivoUsd: patrimonio.pasivo.total,
    patrimonioUsd: patrimonio.patrimonioNeto,
  };

  return (
    <Section title="Patrimonio" ayuda="patrimonio">
      <PatrimonioClient
        patrimonio={patrimonio}
        dolar={dolar}
        hoyIso={hoy}
        historial={serieMensual(snapshots, hoy, MESES_HISTORIAL)}
        variacion={cotizacionOk(patrimonio.cotizacionValida, variacionVsMesAnterior(snapshots, actual, hoy))}
        desdeFoto={primeraFoto(snapshots)}
      />
    </Section>
  );
}

/** Sin cotización válida el balance de hoy no es comparable con el de otros
 *  días: no se muestra variación. */
function cotizacionOk<T>(valida: boolean, v: T | null): T | null {
  return valida ? v : null;
}
