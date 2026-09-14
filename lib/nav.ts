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
  { href: "/compras", label: "Compras", icon: ShoppingBag },
  { href: "/reparaciones", label: "Reparaciones", icon: Wrench },
  { href: "/turnos", label: "Turnos", icon: CalendarClock },
  { href: "/inventario", label: "Inventario", icon: Boxes },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/cuentas-corrientes", label: "Cuentas corrientes", icon: BookUser },
  { href: "/difusion", label: "Difusión", icon: Megaphone },
  { href: "/cajas", label: "Cajas", icon: Wallet },
  { href: "/analiticas", label: "Analíticas", icon: BarChart3 },
  { href: "/configuracion", label: "Configuración", icon: Settings, roles: ["admin"] },
];

export function navForRole(rol: Rol): NavItem[] {
  return NAV.filter((item) => !item.roles || item.roles.includes(rol));
}
