import "server-only";
import { createServerClient, createServiceRoleClient } from "@/lib/auth/supabase";
import {
  esEstadoMp,
  leerReferenciaSuscripcion,
  normalizarEstadoMp,
  periodoHasta,
  type EstadoMp,
} from "@/lib/mercadopago";
import { cancelarPreapproval, type Preapproval } from "@/lib/mercadopago-api";
import { esCiclo, type Ciclo } from "@/lib/planes";

export type SuscripcionMp = {
  preapprovalId: string | null;
  ciclo: Ciclo;
  estado: EstadoMp | null;
  payerEmail: string | null;
};

/** Estado de la suscripción de Mercado Pago de la org del usuario (RLS). */
export async function getSuscripcionMp(): Promise<SuscripcionMp> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("mp_preapproval_id, mp_estado, mp_payer_email, plan_ciclo")
    .single();
  if (error) throw error;
  return {
    preapprovalId: data.mp_preapproval_id,
    ciclo: esCiclo(data.plan_ciclo) ? data.plan_ciclo : "mensual",
    estado: esEstadoMp(data.mp_estado) ? data.mp_estado : null,
    payerEmail: data.mp_payer_email,
  };
}

/**
 * Aplica a la organización el estado de un preapproval leído de la API de
 * Mercado Pago (nunca del cuerpo del webhook). Idempotente: el mismo aviso
 * dos veces deja todo igual.
 * - `authorized`: activa el plan contratado y extiende el período hasta el
 *   próximo cobro. Si la org tenía otra suscripción (cambio de plan), la
 *   cancela recién ahora, así nunca queda sin cobertura.
 * - `paused` / `canceled` de la suscripción vigente: solo se registra; el
 *   período ya pago se respeta y al vencer pasa a solo lectura sola.
 * - Avisos de suscripciones viejas o que nunca se completaron: se ignoran.
 */
export async function aplicarPreapproval(pre: Preapproval, ahora = new Date()): Promise<void> {
  const ref = leerReferenciaSuscripcion(pre.external_reference);
  const estado = normalizarEstadoMp(pre.status);
  if (!ref || !estado) return;

  const service = createServiceRoleClient();
  const { data: org, error } = await service
    .from("organizations")
    .select("id, mp_preapproval_id, periodo_termina_at")
    .eq("id", ref.orgId)
    .maybeSingle();
  if (error) throw error;
  if (!org) return;

  const esLaVigente = org.mp_preapproval_id === pre.id;

  if (estado === "authorized") {
    if (org.mp_preapproval_id && !esLaVigente) {
      await cancelarPreapproval(org.mp_preapproval_id).catch((e) =>
        console.error("[mercadopago] no se pudo cancelar la suscripción anterior", e),
      );
    }
    const { error: upd } = await service
      .from("organizations")
      .update({
        plan: ref.plan,
        plan_estado: "activo",
        periodo_termina_at: periodoHasta({
          proximoCobro: pre.next_payment_date,
          periodoActual: esLaVigente ? org.periodo_termina_at : null,
          ahora,
          ciclo: ref.ciclo,
        }),
        plan_ciclo: ref.ciclo,
        mp_preapproval_id: pre.id,
        mp_estado: "authorized",
        mp_payer_email: pre.payer_email ?? null,
      })
      .eq("id", org.id);
    if (upd) throw upd;
    return;
  }

  if (esLaVigente) {
    const { error: upd } = await service
      .from("organizations")
      .update({ mp_estado: estado })
      .eq("id", org.id);
    if (upd) throw upd;
  }
}
