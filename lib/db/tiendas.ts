import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { resolverTienda } from "@/lib/tiendas";
import type { Tienda, TiendaSeleccion } from "@/lib/types";

/** Tiendas extra activas de la organización (la principal no es una fila). */
export async function listTiendas(): Promise<Tienda[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("tiendas")
    .select("id, nombre")
    .eq("activa", true)
    .order("nombre");
  if (error) throw error;
  return data;
}

/** `tienda_id` para una venta nueva: `null` = la principal. Una tienda
 * «nueva» se crea acá (recién al confirmar la venta) o se reusa si ya
 * existía con el mismo nombre. */
export async function resolveTiendaId(
  sel: TiendaSeleccion | undefined,
  nombrePrincipal: string,
): Promise<string | null> {
  const r = resolverTienda(sel, await listTiendas(), nombrePrincipal);
  if (!r.ok) throw new Error(r.error);
  if (r.accion === "principal") return null;
  if (r.accion === "usar") return r.id;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("tiendas")
    .insert({ nombre: r.nombre })
    .select("id")
    .single();
  if (error) {
    // Carrera: otra venta la creó recién → usar esa.
    if (error.code === "23505") {
      const again = resolverTienda(sel, await listTiendas(), nombrePrincipal);
      if (again.ok && again.accion === "usar") return again.id;
    }
    throw error;
  }
  return data.id;
}
