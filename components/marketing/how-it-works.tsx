import { Reveal, RevealItem, RevealStagger } from "./ui/reveal";

/**
 * "Cómo funciona": 4 pasos con línea conectora (vertical en mobile,
 * horizontal en lg) y reveal secuencial. Las líneas quedan estáticas a
 * propósito: los pasos se revelan encima de ellas, la línea no viaja.
 */

const STEPS = [
  {
    title: "Creá tu organización",
    detail:
      "Registrate con tu email y creá el espacio de tu negocio. Quedás como admin, sin configuración inicial.",
  },
  {
    title: "Invitá a tu equipo",
    detail:
      "Sumá vendedores y técnicos con su propio usuario. Cada rol ve lo que le corresponde.",
  },
  {
    title: "Cargá tu stock",
    detail:
      "Equipos por IMEI, repuestos y accesorios. Si ya lo tenés anotado, importalo por CSV.",
  },
  {
    title: "Vendé, repará y controlá",
    detail:
      "Ventas, tickets, cajas y turnos sobre los mismos datos, con notificaciones en tiempo real para todo el equipo.",
  },
];

export function MarketingHowItWorks() {
  return (
    <section
      id="como-funciona"
      className="scroll-mt-20 border-y border-neutral-200/80 bg-white"
    >
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            Cómo funciona
          </p>
          <h2 className="mt-3 font-grotesk text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            Arrancar no podría ser más simple
          </h2>
          <p className="mt-4 text-base leading-relaxed text-neutral-600">
            Sin instalar nada y sin capacitación larga: el sistema se usa
            desde el primer día.
          </p>
        </Reveal>

        <RevealStagger className="relative mt-14 grid gap-10 sm:gap-12 lg:grid-cols-4 lg:gap-6">
          {/* Conectores: los círculos de número (bg-white, z-10) tapan la línea
              que pasa por detrás. En lg los centros de las 4 columnas quedan
              en 12.5% / 37.5% / 62.5% / 87.5% del ancho. */}
          <div
            aria-hidden="true"
            className="absolute bottom-14 left-[1.25rem] top-5 w-0.5 rounded bg-neutral-200 lg:hidden"
          />
          <div
            aria-hidden="true"
            className="absolute left-[12.5%] right-[12.5%] top-[1.25rem] hidden h-0.5 rounded bg-neutral-200 lg:block"
          />

          {STEPS.map((step, i) => (
            <RevealItem
              key={step.title}
              className="flex gap-4 lg:flex-col lg:items-center lg:gap-0 lg:text-center"
            >
              <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-white font-grotesk text-sm font-semibold text-accent">
                {i + 1}
              </span>
              <div className="lg:mt-5">
                <h3 className="font-grotesk text-base font-semibold text-neutral-900">
                  {step.title}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">
                  {step.detail}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
