import { NextResponse, type NextRequest } from "next/server";
import { aplicarPreapproval } from "@/lib/db/suscripciones";
import { firmaWebhookValida } from "@/lib/mercadopago";
import { getAuthorizedPayment, getPreapproval, mercadoPagoConfigurado } from "@/lib/mercadopago-api";

/** Avisos de Mercado Pago para las suscripciones (`subscription_preapproval`
 *  y `subscription_authorized_payment`). Ruta pública para el middleware
 *  (`/api/webhooks`).
 *
 *  Del aviso solo se usa el tipo y el id: el recurso se vuelve a pedir a la
 *  API de Mercado Pago con nuestro token y se actúa sobre esa respuesta
 *  (`aplicarPreapproval`), así que un aviso falso no puede activar un plan. La
 *  firma (`MERCADOPAGO_WEBHOOK_SECRET`) se valida igual y una inválida queda
 *  en el log. Responde 200 rápido; un error devuelve 500 y Mercado Pago
 *  reintenta. */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!mercadoPagoConfigurado()) return NextResponse.json({ ok: false }, { status: 503 });

  const url = request.nextUrl;
  const body = (await request.json().catch(() => ({}))) as {
    type?: string;
    topic?: string;
    data?: { id?: string | number };
  };
  const tipo = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
  const id = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (!id) return NextResponse.json({ ok: true });

  const secreto = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (
    secreto &&
    !firmaWebhookValida({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId: url.searchParams.get("data.id") ?? id,
      secreto,
    })
  ) {
    console.warn("[mercadopago] aviso con firma inválida", { tipo, id });
  }

  try {
    if (tipo === "subscription_preapproval" || tipo === "preapproval") {
      await aplicarPreapproval(await getPreapproval(id));
    } else if (tipo === "subscription_authorized_payment") {
      const pago = await getAuthorizedPayment(id);
      if (pago.payment?.status === "approved") {
        await aplicarPreapproval(await getPreapproval(pago.preapproval_id));
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[mercadopago] error procesando aviso", { tipo, id }, error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
