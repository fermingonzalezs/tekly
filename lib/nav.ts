import {
  LayoutDashboard,
  ShoppingCart,
  Wrench,
  CalendarClock,
  Boxes,
  Tags,
  Users,
  Wallet,
  Truck,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ventas", label: "Ventas", icon: ShoppingCart },
  { href: "/reparaciones", label: "Reparaciones", icon: Wrench },
  { href: "/turnos", label: "Turnos", icon: CalendarClock },
  { href: "/inventario", label: "Inventario", icon: Boxes },
  { href: "/servicios", label: "Servicios", icon: Tags },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/cajas", label: "Cajas", icon: Wallet },
  { href: "/proveedores", label: "Proveedores", icon: Truck },
  { href: "/analiticas", label: "Analíticas", icon: BarChart3 },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];
