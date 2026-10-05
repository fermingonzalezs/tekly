import { ArrowRight } from "lucide-react";
import { Reveal } from "./ui/reveal";
import { SECTION_WRAP } from "./ui/section-heading";
import { signupUrl } from "@/lib/marketing/app-url";

/**
 * Banner de cierre: bloque sólido accent (sin gradiente) con dos formas
 * blancas translúcidas rotadas de fondo, mismo lenguaje de "formas sólidas"
 * que el hero y la sección de analíticas.
 */
export function MarketingCtaFinal() {
  return (
    <section className={`${SECTION_WRAP} pb-16 sm:pb-24`}>
      <Reveal>
        <div className="relative flex flex-wrap items-center justify-between gap-10 overflow-hidden rounded-[36px] bg-accent px-[clamp(1.5rem,6vw,5rem)] py-[clamp(2.5rem,7vw,5.5rem)] text-white">
          <div
            aria-hidden="true"
            className="absolute -right-[60px] -top-20 h-[340px] w-[340px] rotate-[18deg] rounded-[72px] bg-white/[.08]"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-[120px] right-[140px] h-60 w-60 -rotate-12 rounded-[56px] bg-white/[.06]"
          />

          <div className="relative flex flex-[1_1_520px] flex-col gap-5">
            <h2 className="font-display text-[clamp(2.5rem,5.6vw,4.75rem)] font-extrabold uppercase leading-[.93] tracking-[-0.03em]">
              Todo tu negocio. Un sistema.
            </h2>
            <p className="max-w-[520px] text-lg leading-relaxed text-white/85">
              Cada venta, cada reparación y cada movimiento de caja, en un solo
              lugar y siempre al día.
            </p>
          </div>

          <div className="relative flex flex-col items-start gap-3">
            <a
              href={signupUrl()}
              className="group inline-flex items-center gap-2.5 rounded-full bg-white py-[18px] pl-7 pr-[18px] text-[17px] font-semibold text-neutral-900 transition-colors duration-150 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Empezar gratis
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-accent text-white transition-transform duration-200 group-hover:translate-x-1">
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
              </span>
            </a>
            <span className="text-[13px] text-white/75">
              Los datos de tu organización son solo tuyos.
            </span>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
