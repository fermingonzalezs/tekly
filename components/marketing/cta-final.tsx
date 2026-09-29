import { ArrowRight } from "lucide-react";
import { Reveal } from "./ui/reveal";
import { signupUrl } from "@/lib/marketing/app-url";

/**
 * Banner de cierre. El gradiente índigo está permitido en la landing (ver
 * plan: las reglas "forbidden defaults" de la app de gestión no aplican al
 * contexto de marketing), igual que en el hero del AuthModal.
 */
export function MarketingCtaFinal() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6 sm:pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#352f86] via-accent to-[#7269d4] px-6 py-16 text-center sm:px-12 sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          >
            <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-28 -right-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          </div>

          <h2 className="relative font-grotesk text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Empezá a gestionar tu tienda hoy mismo
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
            Creá tu organización en un minuto, invitá a tu equipo y cargá tu
            stock. El resto del negocio queda registrado solo.
          </p>

          <a
            href={signupUrl()}
            className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-accent shadow-2xl shadow-neutral-900/20 transition-colors duration-150 hover:bg-neutral-100 sm:text-base"
          >
            Empezá gratis
            <ArrowRight className="h-4 w-4" />
          </a>

          <p className="relative mt-5 text-xs text-white/70">
            Sin instalación: funciona en el navegador, con los datos de tu
            organización aislados de los demás.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
