import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { requireUser } from "@/lib/auth";
import { notifyTelegram } from "@/lib/telegram";

/** Guarda el reporte (cualquier usuario, cualquier rol) y avisa por
 * Telegram -- best-effort, ver `notifyTelegram`. `ruta` viaja ya resuelta
 * server-side (`headers().get("referer")` en la action, no un valor que
 * mande el cliente a mano). `accion` = qué estaba haciendo el usuario
 * cuando pasó (texto libre, separado de `descripcion` = qué pasó). */
export async function crearReporteBug(
  descripcion: string,
  ruta: string,
  accion: string,
): Promise<void> {
  const user = await requireUser();
  const supabase = createServerClient();
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
      `Usuario: ${user.nombre} (${user.rol}) · ${user.email}`,
      `Página: ${ruta}`,
      `Estaba haciendo: ${accion}`,
      "",
      descripcion,
    ].join("\n"),
  );
}
