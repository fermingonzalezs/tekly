import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { generarResumenesDeTodasLasOrganizaciones } from "@/lib/db/resumenes";
import { esPeriodo, periodoACerrar } from "@/lib/resumen-mensual";

/** Cron del resumen mensual (plan 022). Lo dispara `pg_cron` (+ `pg_net`) el
 *  día 1 de cada mes (ver `supabase/migrations/20261018110000_*`). Ruta pública
 *  para el middleware (`/api/cron`), pero exige `Authorization: Bearer
 *  <CRON_SECRET>`: sin el secreto responde 401 y no toca nada.
 *
 *  Idempotente: guarda con upsert por (organización, mes), así que reintentar
 *  o disparar dos veces solo reescribe el mismo resumen. Body opcional
 *  `{ "periodo": "2026-09" }` para regenerar un mes puntual. */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function autorizado(request: NextRequest): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false; // sin secreto configurado, la ruta queda cerrada
  const recibido = request.headers.get("authorization") ?? "";
  const esperado = `Bearer ${secreto}`;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let periodo = periodoACerrar(new Date());
  try {
    const body = (await request.json()) as { periodo?: string };
    if (body?.periodo) {
      if (!esPeriodo(body.periodo)) {
        return NextResponse.json({ error: "periodo inválido (YYYY-MM)" }, { status: 400 });
      }
      periodo = body.periodo;
    }
  } catch {
    // sin body: período por defecto
  }
  const resultado = await generarResumenesDeTodasLasOrganizaciones(periodo);
  return NextResponse.json(resultado, { status: resultado.errores.length ? 207 : 200 });
}
