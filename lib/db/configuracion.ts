import "server-only";
import { createServerClient, createServiceRoleClient } from "@/lib/auth/supabase";
import { requireRole } from "@/lib/auth";
import type { Rol } from "@/lib/auth/types";
import type { MedioPagoVenta } from "@/lib/types";
import type { OnboardingPasoId } from "@/lib/onboarding";
import type { PaletaId } from "@/lib/theme-presets";

// ─────────────────────────── Usuarios y roles ───────────────────────────

export type Miembro = {
  id: string;
  nombre: string;
  email: string;
  /** Usuario de Instagram normalizado, o `null`. */
  instagram: string | null;
  rol: Rol;
  activo: boolean;
};

export async function listMiembros(): Promise<Miembro[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre, email, instagram, rol, activo")
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
  /** Espacio libre al final del Ticket de ingreso para aclaraciones propias
   * del negocio -- separado de los términos y condiciones de arriba. */
  reparacionAclaracionesIngreso: string;
  /** Espacio libre al final del Ticket de egreso para aclaraciones propias
   * del negocio -- separado de los términos y condiciones de arriba. */
  reparacionAclaracionesEgreso: string;
  /** % de recargo por medio de pago (ej. `{ tarjeta: 10 }`) -- aumenta lo
   * que cobra el cliente al elegir ese medio en "Nueva venta", ver
   * `montoConRecargo` en `lib/ventas.ts`. Medios sin entrada = sin recargo. */
  recargosMediosPago: Partial<Record<MedioPagoVenta, number>>;
  /** Checklist de onboarding (Dashboard → Bienvenida, ver
   * lib/onboarding.ts) -- qué pasos del setup inicial tildó el admin. */
  onboardingPasos: Partial<Record<OnboardingPasoId, boolean>>;
  /** Paleta de color de la app (Configuración → Datos del negocio) -- uno
   * de los 6 presets de lib/theme-presets.ts; la ve toda la organización. */
  colorTema: PaletaId;
  /** Logo de la organización -- URL pública del bucket `logos` de Storage.
   * Se ve en el TopNav y en el membrete de los recibos. null = placeholder. */
  logoUrl: string | null;
};

/** `organizations` sí tiene policy de select para `authenticated` -- lectura
 * normal, sin service role. */
export async function getNegocio(): Promise<Negocio> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "nombre, direccion, telefono, cuit, horario, objetivo_mes_usd, garantia_texto, garantia_condiciones, garantia_importante, garantia_causales, reparacion_terminos_ingreso, reparacion_terminos_presupuesto, reparacion_terminos_egreso, reparacion_aclaraciones_ingreso, reparacion_aclaraciones_egreso, recargos_medios_pago, onboarding_pasos, color_tema, logo_url",
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
    reparacionAclaracionesIngreso: data.reparacion_aclaraciones_ingreso ?? "",
    reparacionAclaracionesEgreso: data.reparacion_aclaraciones_egreso ?? "",
    recargosMediosPago: data.recargos_medios_pago ?? {},
    onboardingPasos: data.onboarding_pasos ?? {},
    colorTema: data.color_tema,
    logoUrl: data.logo_url ?? null,
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
      reparacion_aclaraciones_ingreso: data.reparacionAclaracionesIngreso || null,
      reparacion_aclaraciones_egreso: data.reparacionAclaracionesEgreso || null,
      recargos_medios_pago: data.recargosMediosPago,
      color_tema: data.colorTema,
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

/** Tilda un solo paso del checklist conservando los demás (merge, no
 * reemplazo como `setOnboardingPasos`). */
export async function marcarPasoOnboarding(paso: OnboardingPasoId): Promise<void> {
  const caller = await requireRole("admin");
  const service = createServiceRoleClient();
  const { data, error: readError } = await service
    .from("organizations")
    .select("onboarding_pasos")
    .eq("id", caller.organizationId)
    .single();
  if (readError) throw readError;
  const { error } = await service
    .from("organizations")
    .update({ onboarding_pasos: { ...(data.onboarding_pasos ?? {}), [paso]: true } })
    .eq("id", caller.organizationId);
  if (error) throw error;
}

/** Pasos del checklist que ya están hechos según los datos de la org, para
 * tildarlos solos aunque se hayan hecho sin pasar por el botón "Ir". */
export async function pasosOnboardingDesdeDatos(
  negocio: Negocio,
): Promise<Partial<Record<OnboardingPasoId, boolean>>> {
  const supabase = createServerClient();
  // Solo filas activas (bajas lógicas no cuentan); servicios no tiene baja lógica.
  const contar = async (tabla: string, columnaActivo?: string) => {
    let query = supabase.from(tabla).select("*", { count: "exact", head: true });
    if (columnaActivo) query = query.eq(columnaActivo, true);
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  };
  const [cajas, servicios, miembros, clientes, celulares, notebooks] = await Promise.all([
    contar("cajas", "activa"),
    contar("servicios"),
    contar("profiles", "activo"),
    contar("clientes", "activo"),
    contar("celulares", "activo"),
    contar("notebooks", "activo"),
  ]);
  return {
    negocio: Boolean(negocio.direccion.trim() && negocio.cuit.trim()),
    importar: clientes + celulares + notebooks > 0,
    cajas: cajas > 0,
    usuarios: miembros > 1,
    servicios: servicios > 0,
  };
}

// ─────────────────────────── Logo ───────────────────────────

/** Sube (o pisa -- `upsert: true`, siempre el mismo path) el logo de la
 * organización al bucket público `logos` y guarda la URL pública en
 * `organizations.logo_url`. Admin-only vía service role: no hay policies
 * de storage, las escrituras pasan por acá y las lecturas son públicas
 * (bucket público, sirve por CDN sin chequear policy). El logo NO va por
 * `updateNegocio`: es un upload, no un campo de texto. */
const LOGO_TIPOS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export async function uploadLogo(
  organizationId: string,
  file: File,
): Promise<string> {
  await requireRole("admin");
  // El bucket es público: se valida tipo y tamaño, y la extensión sale del
  // MIME (nunca del nombre del archivo). Sin SVG: puede llevar scripts y se
  // serviría desde el dominio de Supabase.
  const ext = LOGO_TIPOS[file.type];
  if (!ext) throw new Error("El logo tiene que ser PNG, JPG o WebP.");
  if (file.size > LOGO_MAX_BYTES) throw new Error("El logo no puede pesar más de 2 MB.");
  const service = createServiceRoleClient();
  const path = `${organizationId}/logo.${ext}`;
  const { error } = await service.storage
    .from("logos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = service.storage.from("logos").getPublicUrl(path);
  const { error: updateError } = await service
    .from("organizations")
    .update({ logo_url: data.publicUrl })
    .eq("id", organizationId);
  if (updateError) throw updateError;
  return data.publicUrl;
}

/** Saca el logo de la organización (vuelve al placeholder). No hace falta
 * borrar el archivo del bucket: el próximo upload pisa el mismo path, y un
 * archivo huérfano sin referencia no genera ningún problema. */
export async function removeLogo(organizationId: string): Promise<void> {
  await requireRole("admin");
  const service = createServiceRoleClient();
  const { error } = await service
    .from("organizations")
    .update({ logo_url: null })
    .eq("id", organizationId);
  if (error) throw error;
}
