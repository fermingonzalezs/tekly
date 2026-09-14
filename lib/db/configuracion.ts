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

// ─────────────────────────── Plantillas WhatsApp ───────────────────────────

export type WhatsappTemplate = {
  id: string;
  nombre: string;
  texto: string;
};

export async function listWhatsappTemplates(): Promise<WhatsappTemplate[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("whatsapp_templates")
    .select("id, nombre, texto")
    .order("nombre");
  if (error) throw error;
  return data;
}

/** Alta si `id` es `null`, edición si no. */
export async function saveWhatsappTemplate(
  id: string | null,
  data: { nombre: string; texto: string },
): Promise<WhatsappTemplate> {
  const supabase = createServerClient();
  const query = id
    ? supabase.from("whatsapp_templates").update(data).eq("id", id)
    : supabase.from("whatsapp_templates").insert(data);
  const { data: row, error } = await query.select("id, nombre, texto").single();
  if (error) throw error;
  return row;
}

// ─────────────────────────── Datos del negocio ───────────────────────────

export type Negocio = {
  nombre: string;
  direccion: string;
  telefono: string;
  cuit: string;
  horario: string;
};

/** `organizations` sí tiene policy de select para `authenticated` -- lectura
 * normal, sin service role. */
export async function getNegocio(): Promise<Negocio> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("nombre, direccion, telefono, cuit, horario")
    .single();
  if (error) throw error;
  return {
    nombre: data.nombre,
    direccion: data.direccion ?? "",
    telefono: data.telefono ?? "",
    cuit: data.cuit ?? "",
    horario: data.horario ?? "",
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
    })
    .eq("id", caller.organizationId);
  if (error) throw error;
}
