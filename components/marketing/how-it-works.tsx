import { ArrowRight } from "lucide-react";
import { Reveal, RevealItem, RevealStagger } from "./ui/reveal";
import { MarketingEyebrow } from "./ui/marketing-eyebrow";
import { AmbientBlobs } from "./ui/ambient-blobs";

/**
 * "Cómo funciona": fila horizontal en zigzag (en vez de una timeline
 * vertical larga) -- usa el ancho completo de la sección, mucha menos
 * altura. Cada paso es una tarjeta que aparece una sola vez al entrar en
 * viewport (Reveal, ver ui/reveal.tsx -- respeta prefers-reduced-motion
 * solo), sin efecto de parallax atado al scroll: más prolijo que la
 * versión anterior. El offset vertical alternado (par arriba, impar abajo)
 * + las flechas entre tarjetas dan la sensación de recorrido de lado a
 * lado sin necesidad de una línea conectada pixel-perfect.
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
      className="relative scroll-mt-20 overflow-hidden border-y border-neutral-200/80 bg-white"
    >
      <AmbientBlobs
        blobs={[
          {
            className:
              "absolute left-1/3 -top-24 h-72 w-72 rounded-full bg-accent/5 blur-3xl",
            dx: -22,
            dy: 16,
            duration: 15,
          },
          {
            className:
              "absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-accent/5 blur-3xl",
            dx: 16,
            dy: -18,
            duration: 12,
          },
        ]}
      />
      <div className="mx-auto max-w-[100rem] px-4 py-20 sm:px-6 sm:py-24 xl:px-12">
        <Reveal className="mx-auto max-w-2xl text-center">
          <MarketingEyebrow>Cómo funciona</MarketingEyebrow>
          <h2 className="mt-4 font-grotesk text-5xl font-bold uppercase tracking-tight text-neutral-900 sm:text-6xl">
            Arrancar no podría ser más simple
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600">
            Sin instalar nada y sin capacitación larga: el sistema se usa
            desde el primer día.
          </p>
        </Reveal>

        <RevealStagger className="mt-16 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-4">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-1 items-start gap-4">
              <div
                className={`flex-1 ${i % 2 === 0 ? "lg:mt-0" : "lg:mt-14"}`}
              >
                <RevealItem className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-accent bg-accent-soft font-grotesk text-sm font-semibold text-accent">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-grotesk text-xl font-semibold text-neutral-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-neutral-600">
                    {step.detail}
                  </p>
                </RevealItem>
              </div>

              {i < STEPS.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`hidden shrink-0 items-center pt-10 lg:flex ${i % 2 === 0 ? "lg:mt-0" : "lg:mt-14"}`}
                >
                  <ArrowRight className="h-5 w-5 text-neutral-300" />
                </div>
              )}
            </div>
          ))}
        </RevealStagger>

        <Reveal delay={0.2} className="mt-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            Y quedás list@ para vender ↓
          </p>
        </Reveal>
      </div>
    </section>
  );
}
