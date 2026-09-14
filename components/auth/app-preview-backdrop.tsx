import { Smartphone, ShoppingCart, Wrench, CalendarClock, Boxes } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ChartTitle } from "@/components/ui/chart-title";
import { CHART_ACCENT, GHOST_STRIPES } from "@/lib/chart";

const NAV_DECOR = [
  { label: "Dashboard", icon: Smartphone, active: true },
  { label: "Ventas", icon: ShoppingCart },
  { label: "Reparaciones", icon: Wrench },
  { label: "Turnos", icon: CalendarClock },
  { label: "Inventario", icon: Boxes },
];

const BARRAS = [62, 84, 45, 96, 70, 88, 54];

/**
 * Decorado puramente visual detrás del login/signup -- una versión muda del
 * shell de la app (no data real, no interactivo) para que el fondo del auth
 * se sienta "la aplicación" en vez de una pantalla vacía. Nunca lleva datos
 * de negocio reales: es puro maquetado con valores de ejemplo.
 */
export function AppPreviewBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 scale-105 select-none overflow-hidden blur-[3px]"
    >
      <div className="h-16 flex items-center gap-4 border-b border-neutral-200 bg-white/90 px-5">
        <div className="flex shrink-0 items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white">
            <Smartphone className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold">Tekly</span>
        </div>
        <nav className="flex flex-1 items-center justify-center gap-1">
          {NAV_DECOR.map(({ label, icon: Icon, active }) => (
            <span
              key={label}
              className={
                "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium " +
                (active ? "border-accent text-accent" : "border-transparent text-neutral-500")
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </span>
          ))}
        </nav>
        <div className="h-9 w-9 shrink-0 rounded-full bg-accent" />
      </div>

      <main className="space-y-6 p-8">
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Facturado" value="U$ 48.250" delta={12.4} />
          <StatCard label="Ventas del mes" value={214} hint="unidades" />
          <StatCard label="Tickets abiertos" value={18} hint="en taller" />
          <StatCard label="Stock bajo" value={5} valueClassName="text-red-500" hint="repuestos" />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Card className="p-5">
            <ChartTitle align="left" divider sub="Últimos 7 días">
              Tendencia de ventas
            </ChartTitle>
            <div className="flex h-32 items-end gap-2">
              {BARRAS.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-xl"
                  style={{ height: `${h}%`, background: CHART_ACCENT }}
                />
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <ChartTitle align="left" divider sub="Este mes">
              Objetivo de facturación
            </ChartTitle>
            <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: GHOST_STRIPES }}>
              <div className="h-full rounded-full" style={{ width: "68%", background: CHART_ACCENT }} />
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
