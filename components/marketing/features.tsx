import { Reveal, RevealItem, RevealStagger } from "./ui/reveal";
import { MarketingEyebrow } from "./ui/marketing-eyebrow";

/**
 * Grid de 6 funciones de la landing: una por sección real del sistema, con
 * scroll-reveal en cascada. Copy factual -- sin promesas de features que no
 * existen (ej. alertas de stock, ver plan). El emoji es la firma visual de
 * cada tarjeta (de fondo, grande) -- reemplaza el ícono chico de lucide.
 */

const FEATURES = [
  {
    emoji: "📦",
    title: "Inventario",
    detail:
      "Equipos únicos por IMEI, repuestos por modelo y otros ítems con su cantidad e historial de movimientos.",
  },
  {
    emoji: "🛒",
    title: "Ventas",
    detail:
      "Pago dividido en varios medios, canje de equipos recibidos, cuenta corriente y garantía en PDF.",
  },
  {
    emoji: "💰",
    title: "Cajas",
    detail:
      "Varias cajas por moneda y medio de pago, conciliación contra lo contado y cada movimiento atado a su venta.",
  },
  {
    emoji: "📅",
    title: "Turnos",
    detail:
      "Agenda semanal de compras, entregas y retiros, con los equipos del cliente vinculados a cada turno.",
  },
  {
    emoji: "🔧",
    title: "Reparaciones",
    detail:
      "Tickets con checklist de ingreso y egreso, catálogo de servicios y presupuesto listo para mandarle al cliente.",
  },
  {
    emoji: "📊",
    title: "Analíticas",
    detail:
      "Márgenes por tipo de producto, facturación por vendedor, cohortes de clientes y la foto completa del negocio.",
  },
];

export function MarketingFeatures() {
  return (
    <section id="features" className="scroll-mt-20">
      <div className="mx-auto max-w-[100rem] px-4 py-20 sm:px-6 sm:py-24 xl:px-12">
        <Reveal className="mx-auto max-w-2xl text-center">
          <MarketingEyebrow>Funciones</MarketingEyebrow>
          <h2 className="mt-4 font-display text-5xl font-bold uppercase tracking-tight text-neutral-900 sm:text-6xl">
            Seis módulos, un solo sistema
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600">
            Todo funciona sobre los mismos datos: una venta descuenta stock,
            genera el movimiento de caja y queda en la ficha del cliente. Sin
            planillas paralelas ni datos duplicados.
          </p>
        </Reveal>

        <RevealStagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <RevealItem
              key={feature.title}
              className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-5 -top-6 select-none text-8xl opacity-[0.08] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
              >
                {feature.emoji}
              </span>
              <div className="relative flex flex-col items-center">
                <h3 className="font-display text-lg font-bold uppercase tracking-tight text-neutral-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-base leading-relaxed text-neutral-600">
                  {feature.detail}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
