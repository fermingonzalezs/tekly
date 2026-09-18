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
    href: "/configuracion?tab=negocio",
    icon: Building2,
  },
  {
    id: "importar",
    titulo: "Importá tu inventario o clientes",
    descripcion: "Cargá de una los equipos y clientes que ya tenías antes de usar Tekly.",
    href: "/configuracion?tab=importar",
    icon: Upload,
  },
  {
    id: "cajas",
    titulo: "Creá tus cajas",
    descripcion: "Una por moneda o punto de cobro (ej. Mostrador en pesos, Caja USD).",
    href: "/cajas",
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
    href: "/reparaciones",
    icon: Wrench,
  },
];

/** true cuando los 5 pasos del checklist están tildados -- el Dashboard
 * (`app/(app)/dashboard/page.tsx`) lo usa como segunda forma de salir de
 * "Bienvenida" además de tener una venta cargada. */
export function onboardingCompleto(pasos: Partial<Record<OnboardingPasoId, boolean>>): boolean {
  return PASOS_ONBOARDING.every((paso) => pasos[paso.id]);
}
