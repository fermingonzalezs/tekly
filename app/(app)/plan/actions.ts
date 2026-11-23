"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { aplicarPreapproval, getSuscripcionMp } from "@/lib/db/suscripciones";
import { inicioDelCobro, referenciaSuscripcion } from "@/lib/mercadopago";
import { cancelarPreapproval, crearPreapproval, mercadoPagoConfigurado } from "@/lib/mercadopago-api";
import { PLANES, PLANES_PAGOS, esCiclo, precioCiclo, type Ciclo, type PlanId } from "@/lib/planes";

async function origen(): Promise<string> {
  const configurado = process.env.NEXT_PUBLIC_SITE_URL;
  if (configurado) return configurado.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : "http://localhost:3100";
}

/** Crea la suscripción mensual en Mercado Pago y devuelve el link de pago.
 * `requireRole` (no `requireRoleEscritura`): una cuenta vencida en solo
 * lectura tiene que poder pagar para reactivarse. El plan se activa recién
 * cuando llega el aviso de Mercado Pago (`/api/webhooks/mercadopago`). */
export async function suscribirseAction(
  plan: PlanId,
  ciclo: Ciclo,
  email: string,
): Promise<{ url: string } | { error: string }> {
  const user = await requireRole("admin");
  if (!mercadoPagoConfigurado()) return { error: "El pago con Mercado Pago todavía no está disponible." };
  if (!PLANES_PAGOS.includes(plan) || !esCiclo(ciclo)) return { error: "Plan inválido." };
  const emailOk = z.string().trim().email().safeParse(email);
  if (!emailOk.success) return { error: "Ingresá un email válido." };

  try {
    const pre = await crearPreapproval({
      motivo: `Tekly ${PLANES[plan].label} ${ciclo} - ${user.organizationNombre}`,
      referencia: referenciaSuscripcion(user.organizationId, plan, ciclo),
      payerEmail: emailOk.data,
      montoArs: precioCiclo(plan, ciclo)!,
      meses: ciclo === "anual" ? 12 : 1,
      // Durante la prueba el primer cobro arranca cuando termina.
      inicio: inicioDelCobro(
        user.suscripcion.trialTerminaAt,
        user.suscripcion.estado === "trial",
        new Date(),
      ),
      volverA: `${await origen()}/plan?mp=volver`,
    });
    if (!pre.init_point) return { error: "Mercado Pago no devolvió el link de pago. Probá de nuevo." };
    return { url: pre.init_point };
  } catch (error) {
    console.error("[mercadopago] crear suscripción", error);
    return { error: "No se pudo iniciar el pago con Mercado Pago. Probá de nuevo en unos minutos." };
  }
}

/** Cancela el débito automático. El plan sigue activo hasta el fin del
 * período ya pago y después pasa a solo lectura (lib/planes.ts). */
export async function cancelarSuscripcionAction(): Promise<{ error?: string }> {
  await requireRole("admin");
  const { preapprovalId } = await getSuscripcionMp();
  if (!preapprovalId) return { error: "No hay una suscripción activa." };
  try {
    await aplicarPreapproval(await cancelarPreapproval(preapprovalId));
  } catch (error) {
    console.error("[mercadopago] cancelar suscripción", error);
    return { error: "No se pudo cancelar en Mercado Pago. Probá de nuevo en unos minutos." };
  }
  revalidatePath("/plan");
  return {};
}
