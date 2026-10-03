import {
  ShoppingCart,
  Users,
  Wrench,
  Wallet,
  CalendarClock,
  ShoppingBag,
  BookUser,
  type LucideIcon,
} from "lucide-react";
import type { Rol } from "@/lib/auth/types";
import type { NavItem } from "@/lib/nav";

export type QuickAction = {
  /** También el valor del query param `?accion=` que lo dispara. */
  id: string;
  label: string;
  /** Términos extra para el buscador (sinónimos). */
  keywords: string[];
  icon: LucideIcon;
  href: string;
  /** Mismos roles que la entrada correspondiente en `lib/nav.ts`. */
  roles?: Rol[];
};

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "nueva-venta",
    label: "Nueva venta",
    keywords: ["vender"],
    icon: ShoppingCart,
    href: "/ventas?accion=nueva-venta",
  },
  {
    id: "nuevo-cliente",
    label: "Nuevo cliente",
    keywords: ["alta cliente"],
    icon: Users,
    href: "/clientes?accion=nuevo-cliente",
  },
  {
    id: "nuevo-ticket",
    label: "Nuevo ticket",
    keywords: ["reparación", "reparar"],
    icon: Wrench,
    href: "/reparaciones?accion=nuevo-ticket",
  },
  {
    id: "nuevo-movimiento-caja",
    label: "Nuevo movimiento de caja",
    keywords: ["ingreso", "egreso", "efectivo"],
    icon: Wallet,
    href: "/cajas?accion=nuevo-movimiento-caja",
    roles: ["admin", "tecnico"],
  },
  {
    id: "agendar-turno",
    label: "Agendar turno",
    keywords: ["cita", "agenda"],
    icon: CalendarClock,
    href: "/turnos?accion=agendar-turno",
  },
  {
    id: "nueva-compra",
    label: "Nueva compra",
    keywords: ["proveedor"],
    icon: ShoppingBag,
    href: "/compras?accion=nueva-compra",
    roles: ["admin", "tecnico"],
  },
  {
    id: "registrar-pago",
    label: "Registrar pago",
    keywords: ["cuenta corriente", "cobro", "fiado"],
    icon: BookUser,
    href: "/cuentas-corrientes?accion=registrar-pago",
    roles: ["admin", "tecnico"],
  },
];

export function quickActionsForRole(rol: Rol): QuickAction[] {
  return QUICK_ACTIONS.filter((a) => !a.roles || a.roles.includes(rol));
}

/** Minúsculas + sin tildes, para que "reparacion" (como se tipea en un
 * buscador rápido) matchee "reparación". */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function filterQuickActions(
  actions: QuickAction[],
  query: string,
): QuickAction[] {
  const q = normalizar(query);
  if (!q) return actions;
  return actions.filter(
    (a) =>
      normalizar(a.label).includes(q) ||
      a.keywords.some((k) => normalizar(k).includes(q)),
  );
}

/** Filtra secciones de la nav (`NAV`) por label normalizado -- los resultados
 * "Ir a" de la CommandPalette. Igual criterio que `filterQuickActions`:
 * matcheo local e instantáneo, sin red; el gating por rol lo resuelve quien
 * llama con `navForRole`. */
export function filterNavItems(items: NavItem[], query: string): NavItem[] {
  const q = normalizar(query);
  if (!q) return items;
  return items.filter((i) => normalizar(i.label).includes(q));
}

const APERTURA_MIN = 9 * 60; // 09:00
const CIERRE_MIN = 20 * 60; // 20:00

function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60,
  ).padStart(2, "0")}`;
}

/** Slot default para "Agendar turno" desde el buscador: el próximo horario
 * redondeado a 30 min dentro del rango 09:00–20:00 de `turnos-client.tsx`.
 * No chequea contra turnos ya agendados -- devuelve un horario razonable,
 * igual que clickear un slot ocupado del calendario. */
export function defaultTurnoSlot(
  now: Date = new Date(),
): { dayOffset: number; hora: string } {
  const min = now.getHours() * 60 + now.getMinutes();
  if (min < APERTURA_MIN) return { dayOffset: 0, hora: hhmm(APERTURA_MIN) };
  if (min >= CIERRE_MIN)
    return { dayOffset: 1, hora: hhmm(APERTURA_MIN) }; // mañana a primera hora
  const redondeado = Math.min(Math.ceil(min / 30) * 30, CIERRE_MIN);
  return { dayOffset: 0, hora: hhmm(redondeado) };
}
