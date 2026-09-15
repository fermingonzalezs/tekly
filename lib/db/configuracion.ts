import "server-only";
import { createServerClient, createServiceRoleClient } from "@/lib/auth/supabase";
import { requireRole } from "@/lib/auth";
import type { Rol } from "@/lib/auth/types";

// ─────────────────────────── Usuarios y roles ───────────────────────────

export type Miembro = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
};

export async function listMiembros(): Promise<Miembro[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre, email, rol, activo")
    .order("nombre");
  if (error) throw error;
  return data;
}

// ─────────────────────────── Datos del negocio ───────────────────────────

export type Negocio = {
  nombre: string;
  direccion: string;
  telefono: string;
  cuit: string;
  horario: string;
  /** Meta de facturación del mes en USD -- alimenta el "Objetivo del mes"
   * del Dashboard. Un solo valor vigente, no hay historial por mes. */
  objetivoMesUsd: number;
};

/** `organizations` sí tiene policy de select para `authenticated` -- lectura
 * normal, sin service role. */
export async function getNegocio(): Promise<Negocio> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("nombre, direccion, telefono, cuit, horario, objetivo_mes_usd")
    .single();
  if (error) throw error;
  return {
    nombre: data.nombre,
    direccion: data.direccion ?? "",
    telefono: data.telefono ?? "",
    cuit: data.cuit ?? "",
    horario: data.horario ?? "",
    objetivoMesUsd: data.objetivo_mes_usd,
  };
}

/** `organizations` NO tiene policy de update para `authenticated` (a
 * propósito -- ver la migración): editar datos del negocio es admin-only,
 * vía service role, mismo criterio que `signUp`/`inviteMember` en
 * `lib/auth/index.ts`. */
export async function updateNegocio(data: Negocio): Promise<void> {
  const caller = await requireRole("admin");
  const service = createServiceRoleClient();
  const { error } = await service
    .from("organizations")
    .update({
      nombre: data.nombre,
      direccion: data.direccion || null,
      telefono: data.telefono || null,
      cuit: data.cuit || null,
      horario: data.horario || null,
      objetivo_mes_usd: data.objetivoMesUsd,
    })
    .eq("id", caller.organizationId);
  if (error) throw error;
}
