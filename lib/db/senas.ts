import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { requireUser } from "@/lib/auth";
import { senaEnCaja, type SenaCaja } from "@/lib/pedidos";
import type { MedioPago, PedidoSena } from "@/lib/types";

/** Seña ya validada contra su caja: monto en la moneda de la caja + USD. */
export type SenaResuelta = {
  cajaId: string;
  medio: MedioPago;
  monto: number;
  cotizacion: number;
  senaUsd: number;
};

/** Fila de `movimientos_caja` embebida en un turno (`turno_id`). */
export type SenaMovRow = {
  id: string;
  caja_id: string;
  monto: number | string;
  cotizacion: number | string | null;
  conciliacion_id: string | null;
};

export const SENA_MOV_COLS = "id, caja_id, monto, cotizacion, conciliacion_id";

export function senaDeMovimiento(m: SenaMovRow | undefined): PedidoSena | undefined {
  if (!m) return undefined;
  return {
    movimientoId: m.id,
    cajaId: m.caja_id,
    monto: Number(m.monto),
    cotizacion: m.cotizacion != null ? Number(m.cotizacion) : null,
    conciliado: m.conciliacion_id != null,
  };
}

/** Valida la caja (de la org, activa; **cualquiera**, el medio sale de ella)
 * y pasa el monto a USD. Nunca confía en el USD que mande el cliente. */
export async function resolverSenaCaja(sena: SenaCaja | null): Promise<SenaResuelta | null> {
  if (!sena) return null;
  const supabase = createServerClient();
  const { data: caja, error } = await supabase
    .from("cajas")
    .select("moneda, medio_pago, activa")
    .eq("id", sena.cajaId)
    .maybeSingle();
  if (error) throw error;
  if (!caja || !caja.activa) throw new Error("Elegí una caja activa para la seña.");
  const r = senaEnCaja(caja.moneda, sena.monto, sena.cotizacion);
  if (!r) throw new Error("El monto de la seña no es válido.");
  return {
    cajaId: sena.cajaId,
    medio: caja.medio_pago,
    monto: r.monto,
    cotizacion: sena.cotizacion,
    senaUsd: r.senaUsd,
  };
}

/** Ingreso de la seña de un turno en su caja (etiqueta «Seña»). */
export async function crearMovimientoSenaTurno(turnoId: string, cliente: string, s: SenaResuelta) {
  const user = await requireUser();
  const supabase = createServerClient();
  const { error } = await supabase.from("movimientos_caja").insert({
    caja_id: s.cajaId,
    concepto: `Seña turno · ${cliente}`,
    medio_pago: s.medio,
    tipo: "ingreso",
    monto: s.monto,
    cotizacion: s.cotizacion > 0 ? s.cotizacion : null,
    usuario_id: user.id,
    usuario_nombre: user.nombre,
    turno_id: turnoId,
    etiqueta: "sena",
  });
  if (error) throw error;
}

/** Borra un movimiento de seña solo si todavía no está conciliado. */
export async function borrarMovimientoSena(id: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("movimientos_caja")
    .delete()
    .eq("id", id)
    .is("conciliacion_id", null);
  if (error) throw error;
}
