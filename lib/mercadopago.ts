/**
 * Suscripciones de Mercado Pago (preapproval "sin plan asociado", una por
 * organización). Lógica pura -- sin red ni Supabase --, con test. La llamada a
 * la API vive en `lib/mercadopago-api.ts` y el webhook en
 * `app/api/webhooks/mercadopago/route.ts`.
 *
 * Regla de confianza: el webhook NUNCA usa el contenido del aviso para cambiar
 * un plan. Solo toma el id, vuelve a pedir el recurso a la API de Mercado Pago
 * con nuestro token y actúa sobre esa respuesta. La firma se valida igual,
 * como capa extra.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { esCiclo, esPlanId, type Ciclo, type PlanId } from "@/lib/planes";

/** `external_reference` del preapproval: organización + plan + ciclo. */
export function referenciaSuscripcion(orgId: string, plan: PlanId, ciclo: Ciclo): string {
  return `${orgId}:${plan}:${ciclo}`;
}

/** Las referencias sin ciclo (las primeras, antes del anual) son mensuales. */
export function leerReferenciaSuscripcion(
  ref: string | null | undefined,
): { orgId: string; plan: PlanId; ciclo: Ciclo } | null {
  if (!ref) return null;
  const [orgId, plan, ciclo = "mensual", ...resto] = ref.split(":");
  if (resto.length || !orgId || !esPlanId(plan) || plan === "trial" || !esCiclo(ciclo)) return null;
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) return null;
  return { orgId, plan, ciclo };
}

/** Valida `x-signature` (`ts=...,v1=...`): HMAC SHA256 con la clave secreta
 * del webhook sobre `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. El
 * `data.id` alfanumérico va en minúsculas. */
export function firmaWebhookValida(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secreto: string;
}): boolean {
  const { xSignature, xRequestId, dataId, secreto } = params;
  if (!xSignature || !dataId) return false;
  const partes = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;
  let manifest = `id:${dataId.toLowerCase()};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;
  const esperado = createHmac("sha256", secreto).update(manifest).digest("hex");
  const a = Buffer.from(esperado);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Hasta cuándo queda pago el plan: la próxima fecha de cobro de Mercado
 * Pago; si no viene, un ciclo (1 o 12 meses) desde ahora. Nunca acorta un
 * período ya pago. */
export function periodoHasta(params: {
  proximoCobro: string | null | undefined;
  periodoActual: string | null;
  ahora: Date;
  ciclo?: Ciclo;
}): string {
  const { proximoCobro, periodoActual, ahora, ciclo = "mensual" } = params;
  let hasta: Date;
  if (proximoCobro && !Number.isNaN(Date.parse(proximoCobro))) {
    hasta = new Date(proximoCobro);
  } else {
    hasta = new Date(ahora);
    hasta.setUTCMonth(hasta.getUTCMonth() + (ciclo === "anual" ? 12 : 1));
  }
  if (periodoActual && Date.parse(periodoActual) > hasta.getTime()) return periodoActual;
  return hasta.toISOString();
}

/** Estado de un preapproval tal como lo guarda `organizations.mp_estado`. */
export type EstadoMp = "pending" | "authorized" | "paused" | "canceled";

/** Fecha del primer cobro: si la prueba gratis sigue vigente (al menos un
 * día más), arranca cuando termina, así suscribirse antes no hace perder días
 * de prueba. Mercado Pago lo convierte en días gratis del lado del cobro. */
export function inicioDelCobro(trialTerminaAt: string | null, enPrueba: boolean, ahora: Date): string | null {
  if (!enPrueba || !trialTerminaAt) return null;
  const fin = Date.parse(trialTerminaAt);
  if (Number.isNaN(fin) || fin - ahora.getTime() < 86_400_000) return null;
  return new Date(fin).toISOString();
}

export function esEstadoMp(v: unknown): v is EstadoMp {
  return v === "pending" || v === "authorized" || v === "paused" || v === "canceled";
}

/** La API devuelve (y exige al cancelar) `cancelled`, con doble L, aunque la
 * documentación dice `canceled`: se aceptan las dos y se guarda `canceled`. */
export function normalizarEstadoMp(v: unknown): EstadoMp | null {
  if (v === "cancelled") return "canceled";
  return esEstadoMp(v) ? v : null;
}
