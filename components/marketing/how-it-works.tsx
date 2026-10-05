import { RevealItem, RevealStagger } from "./ui/reveal";
import { GLASS } from "./ui/glass";
import { SectionHeading, SECTION_WRAP } from "./ui/section-heading";
import { cn } from "@/lib/utils";

/**
 * "Cómo funciona": 4 pasos en fila (se apilan en mobile), número display
 * grande en accent. El último paso va en tinta oscura para cerrar el
 * recorrido.
 */

const STEPS = [
  {
    title: "Creá tu organización",
    detail: "Registrate con tu email y creá tu negocio. Quedás como admin.",
  },
  {
    title: "Invitá a tu equipo",
    detail: "Sumá vendedores y técnicos, cada uno con su usuario y su rol.",
  },
  {
    title: "Cargá tu stock",
    detail:
      "Importalo desde tu planilla en CSV o cargalo de cero, lo que te resulte más cómodo.",
  },
  {
    title: "Empezá a registrar",
    detail: "Vendé, repará y controlá tu negocio desde el primer registro.",
  },
];

export function MarketingHowItWorks() {
  return (
    <section
      id="como-funciona"
      className={`${SECTION_WRAP} flex scroll-mt-20 flex-col gap-12 pb-20 sm:pb-36`}
    >
      <SectionHeading
        eyebrow="Cómo funciona"
        title="De la planilla al sistema, hoy"
        lead="Sin instalaciones ni capacitaciones largas. El mismo día que te registrás, ya estás vendiendo."
      />

      <RevealStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => {
          const ultimo = i === STEPS.length - 1;
          return (
            <RevealItem
              key={step.title}
              className={cn(
                "flex h-full flex-col gap-3 rounded-[22px] p-6",
                ultimo ? "bg-[#16151f] text-white" : GLASS,
              )}
            >
              <span
                className={cn(
                  "font-display text-[56px] font-extrabold leading-none tabular-nums",
                  ultimo ? "text-[var(--chart-4)]" : "text-accent",
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-[17px] font-semibold">{step.title}</h3>
              <p
                className={cn(
                  "text-sm leading-normal",
                  ultimo ? "text-white/75" : "text-neutral-600",
                )}
              >
                {step.detail}
              </p>
            </RevealItem>
          );
        })}
      </RevealStagger>
    </section>
  );
}
