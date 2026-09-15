import { Smartphone, ShoppingCart, Wrench, CalendarClock, Boxes } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ChartTitle } from "@/components/ui/chart-title";
import { dotClass, type Tone } from "@/lib/status";

const NAV_DECOR = [
  { label: "Dashboard", icon: Smartphone },
  { label: "Ventas", icon: ShoppingCart, active: true },
  { label: "Reparaciones", icon: Wrench },
  { label: "Turnos", icon: CalendarClock },
  { label: "Inventario", icon: Boxes },
];

const VENTAS_DECOR: { cliente: string; producto: string; total: string; pago: string; tone: Tone }[] = [
  { cliente: "Marcos Díaz", producto: "iPhone 13 128GB", total: "U$ 620", pago: "Transferencia", tone: "blue" },
  { cliente: "Lu Fernández", producto: "Cambio de batería", total: "U$ 45", pago: "Efectivo", tone: "green" },
  { cliente: "Nico Ortega", producto: "iPhone 15 Pro 256GB", total: "U$ 1.180", pago: "Tarjeta", tone: "violet" },
  { cliente: "Cami Suárez", producto: "AirPods Pro 2", total: "U$ 190", pago: "Efectivo", tone: "green" },
];

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

        <Card className="p-5">
          <ChartTitle align="left" divider sub="Últimas operaciones">
            Ventas recientes
          </ChartTitle>
          <table className="w-full">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Producto</th>
                <th className="text-end">Total</th>
                <th>Pago</th>
              </tr>
            </thead>
            <tbody>
              {VENTAS_DECOR.map((v) => (
                <tr key={v.cliente}>
                  <td>{v.cliente}</td>
                  <td>{v.producto}</td>
                  <td className="text-end tabular-nums">{v.total}</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                      <span className={`h-1.5 w-1.5 rounded-full ${dotClass[v.tone]}`} />
                      {v.pago}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>
    </div>
  );
}
