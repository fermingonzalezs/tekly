import "server-only";
import { createServerClient, createServiceRoleClient } from "@/lib/auth/supabase";
import { requireUser } from "@/lib/auth";
import { notifyTelegram } from "@/lib/telegram";
import { etiquetaRoles } from "@/lib/roles";
import type { ResolucionReporte } from "@/lib/types";

const MAX_DESCRIPCION = 2000;
const MAX_ACCION = 300;
const MAX_POR_MINUTO = 3;

/** Guarda el reporte (cualquier usuario, cualquier rol) y avisa por
 * Telegram -- best-effort, ver `notifyTelegram`. `ruta` viaja ya resuelta
 * server-side (`headers().get("referer")` en la action, no un valor que
 * mande el cliente a mano). `accion` = qué estaba haciendo el usuario
 * cuando pasó (texto libre, separado de `descripcion` = qué pasó). */
export async function crearReporteBug(
  descripcion: string,
  ruta: string,
  accion: string,
): Promise<{ error: string | null }> {
  const user = await requireUser();
  const supabase = createServerClient();

  // Tope de largo y de frecuencia: cada reporte dispara un mensaje a Telegram.
  descripcion = descripcion.trim().slice(0, MAX_DESCRIPCION);
  accion = accion.trim().slice(0, MAX_ACCION);
  if (!descripcion) return { error: "Contá qué pasó." };
  const desde = new Date(Date.now() - 60_000).toISOString();
  // `reportes_bugs` no tiene policy de select (solo insert): el conteo va por
  // service role, siempre filtrado por el id de la sesión.
  const { count } = await createServiceRoleClient()
    .from("reportes_bugs")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", user.id)
    .gte("created_at", desde);
  if ((count ?? 0) >= MAX_POR_MINUTO) {
    return { error: "Mandaste varios reportes seguidos. Probá de nuevo en un minuto." };
  }

  const { error } = await supabase.from("reportes_bugs").insert({
    usuario_id: user.id,
    usuario_nombre: user.nombre,
    usuario_email: user.email,
    rol: user.rol,
    ruta,
    accion,
    descripcion,
  });
  if (error) throw error;

  await notifyTelegram(
    [
      "🐛 Nuevo reporte de bug",
      `Organización: ${user.organizationNombre}`,
      `Usuario: ${user.nombre} (${etiquetaRoles(user.roles)}) · ${user.email}`,
      `Página: ${ruta}`,
      `Estaba haciendo: ${accion}`,
      "",
      descripcion,
    ].join("\n"),
  );
  return { error: null };
}


/** Reportes del usuario de la sesión ya resueltos en los últimos 30 días
 * (los no vistos siempre, aunque sean más viejos). Service role filtrado por
 * el id de la sesión: la tabla no tiene policy de select. */
export async function listResolucionesPropias(): Promise<ResolucionReporte[]> {
  const user = await requireUser();
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await createServiceRoleClient()
    .from("reportes_bugs")
    .select("id, descripcion, respuesta, resuelto_at, visto_at")
    .eq("usuario_id", user.id)
    .eq("estado", "resuelto")
    .or(`visto_at.is.null,resuelto_at.gte.${desde}`)
    .order("resuelto_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    descripcion: r.descripcion as string,
    respuesta: (r.respuesta as string | null) ?? "",
    resueltoAt: r.resuelto_at as string,
    visto: r.visto_at !== null,
  }));
}

/** Marca como vistas respuestas del usuario de la sesión (nunca de otro). */
export async function marcarResolucionesVistas(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const user = await requireUser();
  const { error } = await createServiceRoleClient()
    .from("reportes_bugs")
    .update({ visto_at: new Date().toISOString() })
    .eq("usuario_id", user.id)
    .in("id", ids)
    .is("visto_at", null);
  if (error) throw error;
}
