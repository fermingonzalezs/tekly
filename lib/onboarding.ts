import { Building2, Upload, Wallet, Users, Wrench, type LucideIcon } from "lucide-react";

export type OnboardingPasoId = "negocio" | "importar" | "cajas" | "usuarios" | "servicios";

export const PASOS_ONBOARDING: {
  id: OnboardingPasoId;
  titulo: string;
  descripcion: string;
  href: string;
  icon: LucideIcon;
}[] = [
  {
    id: "negocio",
    titulo: "Completá los datos de tu negocio",
    descripcion: "Nombre, dirección, CUIT y horario -- aparecen en recibos y comprobantes.",
    href: "/configuracion?tab=cuenta-negocio",
    icon: Building2,
  },
  {
    id: "importar",
    titulo: "Importá tu inventario o clientes",
    descripcion: "Cargá de una los celulares y clientes que ya tenías antes de usar Tekly.",
    href: "/configuracion?tab=importar",
    icon: Upload,
  },
  {
    id: "cajas",
    titulo: "Creá tus cajas",
    descripcion: "Una por moneda o punto de cobro (ej. Mostrador en pesos, Caja USD).",
    href: "/cajas?tab=cajas&accion=nueva-caja",
    icon: Wallet,
  },
  {
    id: "usuarios",
    titulo: "Invitá a tu equipo",
    descripcion: "Sumá vendedores y técnicos para que trabajen con vos en Tekly.",
    href: "/configuracion?tab=usuarios",
    icon: Users,
  },
  {
    id: "servicios",
    titulo: "Cargá tu catálogo de servicios",
    descripcion: "Reparaciones frecuentes con su precio, en la pestaña Servicios.",
    href: "/reparaciones?vista=servicios&accion=nuevos-servicios",
    icon: Wrench,
  },
];

/** true cuando los 5 pasos del checklist están tildados -- el Dashboard
 * (`app/(app)/dashboard/page.tsx`) lo usa como segunda forma de salir de
 * "Bienvenida" además de tener una venta cargada. */
export function onboardingCompleto(pasos: Partial<Record<OnboardingPasoId, boolean>>): boolean {
  return PASOS_ONBOARDING.every((paso) => pasos[paso.id]);
}

/** Query param que agrega el botón "Ir" del checklist: lleva el id del paso.
 * Las pantallas destino lo leen (`useVolverAlOnboarding`) para tildar ese
 * paso y volver a /dashboard apenas se guarda algo con éxito. */
export const ONBOARDING_PARAM = "onboarding";

export function hrefDesdeOnboarding(paso: { id: OnboardingPasoId; href: string }): string {
  const sep = paso.href.includes("?") ? "&" : "?";
  return `${paso.href}${sep}${ONBOARDING_PARAM}=${paso.id}`;
}

/** Valida el valor del param -- cualquier otra cosa es null (no fabrica pasos). */
export function pasoOnboardingDesdeParam(valor: string | null): OnboardingPasoId | null {
  return PASOS_ONBOARDING.find((paso) => paso.id === valor)?.id ?? null;
}

/** Une los tildes manuales con los que se deducen de los datos cargados
 * (`pasosOnboardingDesdeDatos`): un paso está hecho si cualquiera lo dice. */
export function combinarPasosOnboarding(
  manual: Partial<Record<OnboardingPasoId, boolean>>,
  desdeDatos: Partial<Record<OnboardingPasoId, boolean>>,
): Partial<Record<OnboardingPasoId, boolean>> {
  return Object.fromEntries(
    PASOS_ONBOARDING.map((paso) => [paso.id, Boolean(manual[paso.id] || desdeDatos[paso.id])]),
  );
}
