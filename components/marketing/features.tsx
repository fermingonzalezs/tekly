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
      "Equipos únicos por IMEI, repuestos por modelo y accesorios por cantidad — cada tipo de stock con su propio control.",
  },
  {
    emoji: "🛒",
    title: "Ventas",
    detail:
      "Métodos de pago y cajas personalizables, pago en canje de equipos, cuentas corrientes y comprobantes en PDF para el cliente.",
  },
  {
    emoji: "💰",
    title: "Cajas",
    detail:
      "Varias cajas por moneda, cada una con su medio de pago, conciliación periódica para detectar diferencias a tiempo y el historial completo de cada movimiento.",
  },
  {
    emoji: "📅",
    title: "Turnos",
    detail:
      "Agenda semanal de compras, entregas, retiros y cotizaciones — todo el equipo sabe quién llega y para qué.",
  },
  {
    emoji: "🔧",
    title: "Reparaciones",
    detail:
      "Checklist de ingreso y egreso, catálogo de servicios y repuestos personalizable, y presupuestos a medida para cada cliente.",
  },
  {
    emoji: "📊",
    title: "Analíticas",
    detail:
      "Análisis integral del negocio: márgenes, facturación y comportamiento de tus clientes, en un solo lugar.",
  },
];

export function MarketingFeatures() {
  return (
    <section id="features" className="scroll-mt-20">
      <div className="mx-auto max-w-[100rem] px-4 py-20 sm:px-6 sm:py-24 xl:px-12">
        <Reveal className="mx-auto max-w-2xl text-center">
          <MarketingEyebrow>Módulos</MarketingEyebrow>
          <h2 className="mt-4 font-display text-5xl font-bold uppercase tracking-tight text-neutral-900 sm:text-6xl">
            Un módulo para cada área
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600">
            Seis módulos conectados entre sí, pero separados para que cada
            área trabaje sin pisarse.
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
