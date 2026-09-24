import "server-only";
import { createServerClient, createServiceRoleClient } from "@/lib/auth/supabase";
import { requireRole } from "@/lib/auth";
import type { Rol } from "@/lib/auth/types";
import type { MedioPagoVenta } from "@/lib/types";
import type { OnboardingPasoId } from "@/lib/onboarding";

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
  /** Texto que va en la columna "Garantía" del recibo de garantía, igual
   * para todos los ítems (ej. "Garantía oficial Apple (12 meses)") -- no
   * hay variación por ítem/modelo, es una decisión de producto para no
   * agregar el campo a `venta_items`. */
  garantiaTexto: string;
  garantiaCondiciones: string;
  garantiaImportante: string;
  /** Una causal de anulación por línea -- se renderiza como lista. */
  garantiaCausales: string;
  /** Términos y condiciones de los tickets de reparación -- un texto propio
   * por documento (no uno compartido), distintos de los `garantia*` de
   * arriba (esos son para Ventas). */
  reparacionTerminosIngreso: string;
  reparacionTerminosPresupuesto: string;
  reparacionTerminosEgreso: string;
  /** % de recargo por medio de pago (ej. `{ tarjeta: 10 }`) -- aumenta lo
   * que cobra el cliente al elegir ese medio en "Nueva venta", ver
   * `montoConRecargo` en `lib/ventas.ts`. Medios sin entrada = sin recargo. */
  recargosMediosPago: Partial<Record<MedioPagoVenta, number>>;
  /** Checklist de onboarding (Dashboard → Bienvenida, ver
   * lib/onboarding.ts) -- qué pasos del setup inicial tildó el admin. */
  onboardingPasos: Partial<Record<OnboardingPasoId, boolean>>;
};

/** `organizations` sí tiene policy de select para `authenticated` -- lectura
 * normal, sin service role. */
export async function getNegocio(): Promise<Negocio> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "nombre, direccion, telefono, cuit, horario, objetivo_mes_usd, garantia_texto, garantia_condiciones, garantia_importante, garantia_causales, reparacion_terminos_ingreso, reparacion_terminos_presupuesto, reparacion_terminos_egreso, recargos_medios_pago, onboarding_pasos",
    )
    .single();
  if (error) throw error;
  return {
    nombre: data.nombre,
    direccion: data.direccion ?? "",
    telefono: data.telefono ?? "",
    cuit: data.cuit ?? "",
    horario: data.horario ?? "",
    objetivoMesUsd: data.objetivo_mes_usd,
    garantiaTexto: data.garantia_texto ?? "",
    garantiaCondiciones: data.garantia_condiciones ?? "",
    garantiaImportante: data.garantia_importante ?? "",
    garantiaCausales: data.garantia_causales ?? "",
    reparacionTerminosIngreso: data.reparacion_terminos_ingreso ?? "",
    reparacionTerminosPresupuesto: data.reparacion_terminos_presupuesto ?? "",
    reparacionTerminosEgreso: data.reparacion_terminos_egreso ?? "",
    recargosMediosPago: data.recargos_medios_pago ?? {},
    onboardingPasos: data.onboarding_pasos ?? {},
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
      garantia_texto: data.garantiaTexto || null,
      garantia_condiciones: data.garantiaCondiciones || null,
      garantia_importante: data.garantiaImportante || null,
      garantia_causales: data.garantiaCausales || null,
      reparacion_terminos_ingreso: data.reparacionTerminosIngreso || null,
      reparacion_terminos_presupuesto: data.reparacionTerminosPresupuesto || null,
      reparacion_terminos_egreso: data.reparacionTerminosEgreso || null,
      recargos_medios_pago: data.recargosMediosPago,
    })
    .eq("id", caller.organizationId);
  if (error) throw error;
}

/** Tilda/destilda pasos del checklist de onboarding (Dashboard →
 * Bienvenida). El cliente manda el mapa completo (ya lo tiene cargado desde
 * `Negocio.onboardingPasos`), así que es un reemplazo directo -- mismo
 * criterio admin-only + service role que `updateNegocio`. */
export async function setOnboardingPasos(
  pasos: Partial<Record<OnboardingPasoId, boolean>>,
): Promise<void> {
  const caller = await requireRole("admin");
  const service = createServiceRoleClient();
  const { error } = await service
    .from("organizations")
    .update({ onboarding_pasos: pasos })
    .eq("id", caller.organizationId);
  if (error) throw error;
}
