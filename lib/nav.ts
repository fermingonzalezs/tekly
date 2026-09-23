import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  Wrench,
  CalendarClock,
  Boxes,
  Users,
  BookUser,
  Megaphone,
  Wallet,
  BarChart3,
  ClipboardCheck,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Rol } from "@/lib/auth/types";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles que pueden ver este ítem. Sin esto, todos los roles lo ven --
   * la mayoría de las secciones no tienen restricción todavía, esto es
   * solo el mecanismo de gating, no una política de permisos completa. */
  roles?: Rol[];
};

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ventas", label: "Ventas", icon: ShoppingCart },
  { href: "/compras", label: "Compras", icon: ShoppingBag, roles: ["admin", "tecnico"] },
  { href: "/reparaciones", label: "Reparaciones", icon: Wrench },
  { href: "/turnos", label: "Turnos", icon: CalendarClock },
  { href: "/inventario", label: "Inventario", icon: Boxes },
  { href: "/recuentos", label: "Recuentos", icon: ClipboardCheck },
  { href: "/clientes", label: "Clientes", icon: Users },
  {
    href: "/cuentas-corrientes",
    label: "Cuentas corrientes",
    icon: BookUser,
    roles: ["admin", "tecnico"],
  },
  { href: "/difusion", label: "Difusión", icon: Megaphone },
  { href: "/cajas", label: "Cajas", icon: Wallet, roles: ["admin", "tecnico"] },
  { href: "/analiticas", label: "Analíticas", icon: BarChart3, roles: ["admin", "tecnico"] },
  { href: "/configuracion", label: "Configuración", icon: Settings, roles: ["admin"] },
];

export function navForRole(rol: Rol): NavItem[] {
  return NAV.filter((item) => !item.roles || item.roles.includes(rol));
}

/** Categoría de la navbar horizontal (TopNav, md+): agrupa subsecciones
 * relacionadas bajo un solo botón para no listar las 11 secciones sueltas
 * en pantallas medianas. Una categoría con un solo `href` (Dashboard,
 * Reparaciones, Clientes) es un link directo; con más de uno (Ventas,
 * Stock, Finanzas) es un dropdown. El drawer mobile (`MobileNavDrawer`)
 * sigue usando `navForRole` sin agrupar -- ahí entran cómodas las 11 en una
 * lista vertical, agruparlas no hacía falta. */
type NavGroupDef = { label: string; icon: LucideIcon; hrefs: string[] };

const NAV_GROUPS: NavGroupDef[] = [
  { label: "Dashboard", icon: LayoutDashboard, hrefs: ["/dashboard"] },
  { label: "Ventas", icon: ShoppingCart, hrefs: ["/ventas", "/turnos", "/difusion"] },
  { label: "Reparaciones", icon: Wrench, hrefs: ["/reparaciones"] },
  { label: "Stock", icon: Boxes, hrefs: ["/inventario", "/compras", "/recuentos"] },
  { label: "Clientes", icon: Users, hrefs: ["/clientes"] },
  { label: "Finanzas", icon: Wallet, hrefs: ["/cajas", "/analiticas", "/cuentas-corrientes"] },
];

export type NavCategory = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** length 1 => link directo (usar children[0]); length > 1 => dropdown. */
  children: NavItem[];
};

export function navCategoriesForRole(rol: Rol): NavCategory[] {
  const visible = navForRole(rol);
  return NAV_GROUPS.map((g) => ({
    key: g.hrefs[0],
    label: g.label,
    icon: g.icon,
    children: g.hrefs
      .map((href) => visible.find((i) => i.href === href))
      .filter((i): i is NavItem => Boolean(i)),
  })).filter((g) => g.children.length > 0);
}
