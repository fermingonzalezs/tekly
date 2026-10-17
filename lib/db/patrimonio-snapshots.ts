import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import type { Patrimonio } from "@/lib/patrimonio";
import type { SnapshotPatrimonio } from "@/lib/patrimonio-historial";

/** Fotos diarias del patrimonio (`patrimonio_snapshots`, plan 019 fase 2).
 *  Se escriben de forma perezosa al abrir `/patrimonio` -- sin cron. */

type SnapshotRow = {
  fecha: string;
  cotizacion: number | string;
  activo_usd: number | string;
  pasivo_usd: number | string;
  patrimonio_usd: number | string;
};

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Guarda (o actualiza) la foto de `fecha` con el balance de ahora: si el
 *  admin entra varias veces en el día, queda la última. **Nunca rompe la
 *  página**: en una cuenta en solo lectura la RLS rechaza el insert y acá se
 *  traga el error (el historial simplemente no avanza). `false` si no se
 *  pudo guardar. */
export async function registrarSnapshot(
  organizationId: string,
  p: Patrimonio,
  fecha: string,
): Promise<boolean> {
  if (!p.cotizacionValida) return false; // sin cotización el neto sería engañoso
  try {
    const supabase = createServerClient();
    const { error } = await supabase.from("patrimonio_snapshots").upsert(
      {
        organization_id: organizationId,
        fecha,
        cotizacion: p.cotizacion,
        activo_usd: redondear(p.activo.total),
        pasivo_usd: redondear(p.pasivo.total),
        patrimonio_usd: redondear(p.patrimonioNeto),
        detalle: {
          disponibilidades: redondear(p.activo.disponibilidades.total),
          creditos: redondear(p.activo.creditos.total),
          inventario: redondear(p.activo.inventario.total),
          anticipos: redondear(p.activo.anticipos.total),
        },
      },
      { onConflict: "organization_id,fecha" },
    );
    return !error;
  } catch {
    return false;
  }
}

/** Fotos de los últimos `meses` meses calendario (incluido el en curso),
 *  ascendentes. `desde` = primer día del mes más viejo, `YYYY-MM-DD`. */
export async function listSnapshots(desde: string): Promise<SnapshotPatrimonio[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("patrimonio_snapshots")
    .select("fecha, cotizacion, activo_usd, pasivo_usd, patrimonio_usd")
    .gte("fecha", desde)
    .order("fecha", { ascending: true });
  if (error) throw error;
  return (data as SnapshotRow[]).map((r) => ({
    fecha: r.fecha,
    cotizacion: Number(r.cotizacion),
    activoUsd: Number(r.activo_usd),
    pasivoUsd: Number(r.pasivo_usd),
    patrimonioUsd: Number(r.patrimonio_usd),
  }));
}
