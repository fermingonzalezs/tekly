import { ArrowRight } from "lucide-react";
import { Reveal, RevealItem, RevealStagger } from "./ui/reveal";
import { MarketingEyebrow } from "./ui/marketing-eyebrow";

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
      "Registrate con tu email y creá tu organización. Quedás como admin, sin configuración inicial.",
  },
  {
    title: "Invitá a tu equipo",
    detail:
      "Sumá vendedores y técnicos con su propio usuario: cada rol ve lo que le corresponde.",
  },
  {
    title: "Cargá tu stock",
    detail:
      "Importá tu stock por CSV si ya lo tenés anotado, o cargalo de cero — lo que te resulte más cómodo.",
  },
  {
    title: "Empezá a registrar",
    detail:
      "Ya tenés todo listo: vendé, repará y controlá tu negocio desde el primer registro.",
  },
];

export function MarketingHowItWorks() {
  return (
    <section
      id="como-funciona"
      className="scroll-mt-20 border-y border-neutral-200/80 bg-white"
    >
      <div className="mx-auto max-w-[100rem] px-4 py-20 sm:px-6 sm:py-24 xl:px-12">
        <Reveal className="mx-auto max-w-2xl text-center">
          <MarketingEyebrow>Cómo funciona</MarketingEyebrow>
          <h2 className="mt-4 font-display text-5xl font-bold uppercase tracking-tight text-neutral-900 sm:text-6xl">
            De la planilla al sistema, hoy
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600">
            Sin instalaciones tediosas ni capacitaciones largas: el sistema
            se usa desde el primer día.
          </p>
        </Reveal>

        <RevealStagger className="mt-16 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-4">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-1 items-start gap-4">
              <div
                className={`flex-1 ${i % 2 === 0 ? "lg:mt-0" : "lg:mt-14"}`}
              >
                <RevealItem className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-accent bg-accent-soft font-display text-sm font-semibold text-accent">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-display text-xl font-semibold text-neutral-900">
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
      </div>
    </section>
  );
}
