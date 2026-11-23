/**
 * Planes y prueba gratis (plan 015). Lógica pura -- sin Supabase -- para que
 * la usen el server (gating de actions, cupo de usuarios) y el cliente
 * (banner, pantalla /plan) sin importar nada `server-only`.
 *
 * Modelo (columnas de `organizations`): `plan` + `plan_estado` +
 * `trial_termina_at` + `periodo_termina_at`. El cobro es manual por ahora
 * (transferencia): el admin de plataforma asigna plan y fin de período desde
 * `/admin`; el día que haya proveedor de pagos, el webhook escribe lo mismo.
 */

export type PlanId = "trial" | "starter" | "business" | "business_plus";
export type PlanEstado = "trial" | "activo" | "vencido" | "cancelado";

export const TRIAL_DIAS = 30;
/** Días de gracia después de `periodo_termina_at`: cubre los reintentos de
 * Mercado Pago cuando falla un débito (y las transferencias manuales, que no
 * siempre se acreditan el mismo día). */
export const GRACIA_DIAS = 7;

export const PLANES: Record<PlanId, { label: string; maxUsuarios: number; precioArs: number | null }> = {
  // La prueba es el plan Starter gratis: mismo cupo de usuarios.
  trial: { label: "Prueba gratis", maxUsuarios: 1, precioArs: null },
  starter: { label: "Starter", maxUsuarios: 1, precioArs: 29990 },
  business: { label: "Business", maxUsuarios: 3, precioArs: 49990 },
  business_plus: { label: "Business+", maxUsuarios: 10, precioArs: 99990 },
};

/** Ciclo de cobro: mensual o anual. El anual cobra 10 meses y regala 2. */
export type Ciclo = "mensual" | "anual";
export const MESES_PAGOS_ANUAL = 10;

export function esCiclo(v: unknown): v is Ciclo {
  return v === "mensual" || v === "anual";
}

/** Lo que se cobra por ciclo (null en la prueba). */
export function precioCiclo(plan: PlanId, ciclo: Ciclo): number | null {
  const mensual = PLANES[plan].precioArs;
  if (mensual === null) return null;
  return ciclo === "anual" ? mensual * MESES_PAGOS_ANUAL : mensual;
}

/** Cuánto se ahorra al año pagando anual. */
export function ahorroAnual(plan: PlanId): number {
  const mensual = PLANES[plan].precioArs ?? 0;
  return mensual * (12 - MESES_PAGOS_ANUAL);
}

/** Planes que se pueden contratar (todos menos la prueba). */
export const PLANES_PAGOS: PlanId[] = ["starter", "business", "business_plus"];

export function esPlanId(v: unknown): v is PlanId {
  return typeof v === "string" && v in PLANES;
}

export function esPlanEstado(v: unknown): v is PlanEstado {
  return v === "trial" || v === "activo" || v === "vencido" || v === "cancelado";
}

/** Lo que `getSession` lee de `organizations`; viaja en `SessionUser`. */
export type Suscripcion = {
  plan: PlanId;
  estado: PlanEstado;
  trialTerminaAt: string | null;
  periodoTerminaAt: string | null;
};

export type Acceso =
  /** Plan pago al día. */
  | { modo: "ok"; diasRestantes: number | null }
  /** Prueba gratis en curso. */
  | { modo: "trial"; diasRestantes: number }
  /** Prueba o período vencidos, o cuenta cancelada: se ve todo, no se escribe. */
  | { modo: "solo_lectura"; motivo: "trial_vencido" | "periodo_vencido" | "cancelado" };

const DIA_MS = 86_400_000;

function diasHasta(iso: string, ahora: Date): number {
  return Math.ceil((new Date(iso).getTime() - ahora.getTime()) / DIA_MS);
}

export function estadoDeAcceso(s: Suscripcion, ahora: Date = new Date()): Acceso {
  if (s.estado === "cancelado") return { modo: "solo_lectura", motivo: "cancelado" };
  if (s.estado === "vencido") {
    return {
      modo: "solo_lectura",
      motivo: s.plan === "trial" ? "trial_vencido" : "periodo_vencido",
    };
  }
  if (s.estado === "trial") {
    if (!s.trialTerminaAt) return { modo: "ok", diasRestantes: null };
    const dias = diasHasta(s.trialTerminaAt, ahora);
    if (dias <= 0) return { modo: "solo_lectura", motivo: "trial_vencido" };
    return { modo: "trial", diasRestantes: dias };
  }
  // activo
  if (!s.periodoTerminaAt) return { modo: "ok", diasRestantes: null };
  const dias = diasHasta(s.periodoTerminaAt, ahora);
  if (dias + GRACIA_DIAS <= 0) return { modo: "solo_lectura", motivo: "periodo_vencido" };
  return { modo: "ok", diasRestantes: dias };
}

export function puedeEscribir(s: Suscripcion, ahora: Date = new Date()): boolean {
  return estadoDeAcceso(s, ahora).modo !== "solo_lectura";
}

export type Cupo = { max: number; usados: number; disponibles: number; lleno: boolean };

/** `usados` = perfiles activos de la organización (incluye invitaciones aún
 * sin aceptar: ya ocupan un lugar). */
export function cupoUsuarios(plan: PlanId, usados: number): Cupo {
  const max = PLANES[plan].maxUsuarios;
  const disponibles = Math.max(0, max - usados);
  return { max, usados, disponibles, lleno: usados >= max };
}

/** Mensaje de solo lectura para mostrar en la UI. */
export function motivoSoloLectura(
  motivo: "trial_vencido" | "periodo_vencido" | "cancelado",
): string {
  switch (motivo) {
    case "trial_vencido":
      return `Terminó tu prueba gratis de ${TRIAL_DIAS} días.`;
    case "periodo_vencido":
      return "Venció el período de tu plan.";
    case "cancelado":
      return "Tu suscripción está cancelada.";
  }
}

/** ISO -> `yyyy-mm-dd` en hora de Argentina (UTC-3, sin DST), para el
 * `<input type="date">` del panel de plataforma. */
export function fechaParaInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}
