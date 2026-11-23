import "server-only";
import { randomUUID } from "node:crypto";

/** Cliente mínimo de la API de Suscripciones de Mercado Pago (fetch directo,
 * sin SDK). Solo server: usa `MERCADOPAGO_ACCESS_TOKEN`. */
const BASE = "https://api.mercadopago.com";

export type Preapproval = {
  id: string;
  status: string;
  external_reference: string | null;
  payer_email?: string | null;
  init_point?: string;
  next_payment_date?: string | null;
};

export type AuthorizedPayment = {
  id: number;
  preapproval_id: string;
  status: string;
  payment?: { id: number; status: string; status_detail?: string } | null;
};

export function mercadoPagoConfigurado(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

async function mp<T>(method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN no está configurado");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(method === "POST" ? { "X-Idempotency-Key": randomUUID() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Mercado Pago ${method} ${path}: ${res.status} ${detalle.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** Crea la suscripción con pago pendiente: devuelve `init_point`, el link
 * donde el cliente elige el medio de pago y autoriza el débito mensual. */
export function crearPreapproval(params: {
  motivo: string;
  referencia: string;
  payerEmail: string;
  montoArs: number;
  volverA: string;
}): Promise<Preapproval> {
  return mp<Preapproval>("POST", "/preapproval", {
    reason: params.motivo,
    external_reference: params.referencia,
    payer_email: params.payerEmail,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: params.montoArs,
      currency_id: "ARS",
    },
    back_url: params.volverA,
    status: "pending",
  });
}

export function getPreapproval(id: string): Promise<Preapproval> {
  return mp<Preapproval>("GET", `/preapproval/${encodeURIComponent(id)}`);
}

export function getAuthorizedPayment(id: string): Promise<AuthorizedPayment> {
  return mp<AuthorizedPayment>("GET", `/authorized_payments/${encodeURIComponent(id)}`);
}

export function cancelarPreapproval(id: string): Promise<Preapproval> {
  return mp<Preapproval>("PUT", `/preapproval/${encodeURIComponent(id)}`, { status: "canceled" });
}
