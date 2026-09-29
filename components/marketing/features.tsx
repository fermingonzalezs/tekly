import {
  BarChart3,
  CalendarDays,
  Package,
  ShoppingCart,
  Wallet,
  Wrench,
} from "lucide-react";
import { Reveal, RevealItem, RevealStagger } from "./ui/reveal";

/**
 * Grid de 6 funciones de la landing: una por sección real del sistema, con
 * scroll-reveal en cascada. Copy factual -- sin promesas de features que no
 * existen (ej. alertas de stock, ver plan).
 */

const FEATURES = [
  {
    icon: Package,
    title: "Inventario",
    detail:
      "Equipos únicos por IMEI, repuestos por modelo y otros ítems con su cantidad e historial de movimientos.",
  },
  {
    icon: Wrench,
    title: "Reparaciones",
    detail:
      "Tickets con checklist de ingreso y egreso, catálogo de servicios y presupuesto listo para mandarle al cliente.",
  },
  {
    icon: ShoppingCart,
    title: "Ventas",
    detail:
      "Pago dividido en varios medios, canje de equipos recibidos, cuenta corriente y garantía en PDF.",
  },
  {
    icon: Wallet,
    title: "Cajas",
    detail:
      "Varias cajas por moneda y medio de pago, conciliación contra lo contado y cada movimiento atado a su venta.",
  },
  {
    icon: CalendarDays,
    title: "Turnos",
    detail:
      "Agenda semanal de compras, entregas y retiros, con los equipos del cliente vinculados a cada turno.",
  },
  {
    icon: BarChart3,
    title: "Analíticas",
    detail:
      "Márgenes por tipo de producto, facturación por vendedor, cohortes de clientes y la foto completa del negocio.",
  },
];

export function MarketingFeatures() {
  return (
    <section id="features" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            Funciones
          </p>
          <h2 className="mt-3 font-grotesk text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            Seis módulos, un solo sistema
          </h2>
          <p className="mt-4 text-base leading-relaxed text-neutral-600">
            Todo funciona sobre los mismos datos: una venta descuenta stock,
            genera el movimiento de caja y queda en la ficha del cliente. Sin
            planillas paralelas ni datos duplicados.
          </p>
        </Reveal>

        <RevealStagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <RevealItem
              key={feature.title}
              className="rounded-2xl border border-neutral-200 bg-white p-5 transition-colors duration-150 hover:border-accent/50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <feature.icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <h3 className="mt-4 font-grotesk text-base font-semibold text-neutral-900">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                {feature.detail}
              </p>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
