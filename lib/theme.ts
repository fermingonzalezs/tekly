import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import type { PaletaId } from "@/lib/theme-presets";

/** Paleta activa: la de la organización del usuario logueado, para el
 * `data-tema` del <html> que setea el layout raíz. Se resuelve por request
 * (SSR) -- un usuario con la app abierta en otra pestaña la ve recién al
 * navegar/refrescar. Sin usuario (páginas pre-login) → "indigo": en un
 * signup self-serve no hay forma de saber la organización antes de
 * loguearse. */
export async function getActiveTema(): Promise<PaletaId> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "indigo";
  // Relación embebida to-one (profiles → organizations por FK): en runtime
  // vuelve como objeto -- mismo cast de fila-plana que lib/auth/index.ts.
  const { data } = await supabase
    .from("profiles")
    .select("organizations(color_tema)")
    .eq("id", user.id)
    .maybeSingle<{ organizations: { color_tema: PaletaId } | null }>();
  return data?.organizations?.color_tema ?? "indigo";
}
