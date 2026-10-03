import {
  LayoutDashboard,
  ShoppingCart,
  Wrench,
  Boxes,
  Users,
  Wallet,
  ChevronDown,
  Bell,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

/**
 * Barra de navegador + topnav compartidos por los mockups "ventana
 * completa" de la landing (Turnos, Cajas, buscador, ...): réplica del
 * real `components/topnav.tsx` -- mismas 6 categorías de
 * `navCategoriesForRole` (`lib/nav.ts`), mismo logo de dos líneas y mismo
 * cluster de la derecha (Dólar blue + campana + avatar). `activo` marca
 * cuál categoría está resaltada (la del dominio que ilustra ese mockup);
 * dejalo `undefined` si el dominio no es una de las 6 (ej. Difusión).
 * Decorativo, sin lógica -- mismo criterio que `MockupDashboard`.
 */

const CATEGORIAS: { label: string; icon: LucideIcon; dropdown?: boolean }[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Ventas", icon: ShoppingCart, dropdown: true },
  { label: "Reparaciones", icon: Wrench },
  { label: "Stock", icon: Boxes, dropdown: true },
  { label: "Clientes", icon: Users },
  { label: "Finanzas", icon: Wallet, dropdown: true },
];

export function MockupChrome({ activo }: { activo?: string }) {
  return (
    <>
      {/* Barra superior tipo navegador */}
      <div className="flex items-center gap-1.5 border-b border-neutral-100 bg-neutral-50 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-neutral-200" />
        <span className="h-2 w-2 rounded-full bg-neutral-200" />
        <span className="h-2 w-2 rounded-full bg-neutral-200" />
        <div className="ml-2 h-3 flex-1 rounded-full bg-neutral-100" />
      </div>

      {/* Topnav real: logo + categorías + cluster de la derecha. Escala
          "miniatura de pantalla real", no un recorte agrandado. */}
      <div className="flex items-center gap-1.5 border-b border-neutral-100 px-3 py-1.5">
        <div className="flex shrink-0 items-center gap-1">
          <div className="flex h-4 w-4 items-center justify-center rounded-md bg-accent text-white">
            <Smartphone className="h-2.5 w-2.5" />
          </div>
          <span className="hidden flex-col leading-none sm:flex">
            <span className="font-grotesk text-[6px] font-semibold uppercase tracking-wide text-neutral-900">
              Tekly
            </span>
            <span className="text-[5px] font-medium text-neutral-400">by tekly</span>
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-0.5">
          {CATEGORIAS.map(({ label, icon: Icon, dropdown }) => (
            <span
              key={label}
              className={`flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-[3px] text-[6px] font-medium ${
                label === activo
                  ? "border-accent bg-white text-accent"
                  : "border-transparent text-neutral-500"
              }`}
            >
              <Icon className="h-2 w-2 shrink-0" />
              <span className="hidden lg:inline">{label}</span>
              {dropdown && <ChevronDown className="hidden h-1.5 w-1.5 lg:inline" />}
            </span>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span className="hidden items-center gap-1 rounded-md border border-neutral-200 bg-white px-1.5 py-[3px] sm:flex">
            <span className="text-[5px] font-semibold uppercase tracking-wide text-neutral-500">
              Dólar blue
            </span>
            <span className="text-[6.5px] font-semibold tabular-nums text-neutral-800">
              $ 1.560
            </span>
            <span className="h-[3px] w-[3px] rounded-full bg-emerald-500" />
          </span>
          <span className="relative grid h-4 w-4 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-500">
            <Bell className="h-2 w-2" />
            <span className="absolute -right-0.5 -top-0.5 grid h-[7px] w-[7px] place-items-center rounded-full bg-accent text-[4.5px] font-semibold text-white">
              2
            </span>
          </span>
          <span className="grid h-4 w-4 place-items-center rounded-full bg-accent text-[6px] font-semibold text-white">
            F
          </span>
        </div>
      </div>
    </>
  );
}
