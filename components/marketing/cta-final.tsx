import { ArrowRight } from "lucide-react";
import { Reveal } from "./ui/reveal";
import { MarketingButton } from "./ui/marketing-button";
import { MarketingEyebrow } from "./ui/marketing-eyebrow";
import { AmbientBlobs } from "./ui/ambient-blobs";
import { signupUrl } from "@/lib/marketing/app-url";

/**
 * Banner de cierre. El gradiente está permitido en la landing (ver plan: las
 * reglas "forbidden defaults" de la app de gestión no aplican al contexto de
 * marketing), igual que en el hero del AuthModal -- arma con las CSS vars de
 * la paleta activa (`--chart-*`, app/globals.css) en vez de hex fijos, para
 * seguir la paleta de marketing (violeta) en vez de quedar índigo a mano.
 */
export function MarketingCtaFinal() {
  return (
    <section className="mx-auto max-w-[100rem] px-4 pb-20 pt-4 sm:px-6 sm:pb-24 xl:px-12">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,var(--chart-1),var(--chart-2),var(--chart-3))] px-6 py-16 text-center sm:px-12 sm:py-20">
          <AmbientBlobs
            blobs={[
              {
                className:
                  "absolute -left-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl",
                dx: 20,
                dy: 16,
                duration: 12,
              },
              {
                className:
                  "absolute -bottom-28 -right-16 h-72 w-72 rounded-full bg-white/10 blur-3xl",
                dx: -22,
                dy: -18,
                duration: 15,
              },
            ]}
          />

          <MarketingEyebrow tone="light" className="relative">
            Empezá hoy
          </MarketingEyebrow>

          <h2 className="relative mt-4 font-grotesk text-5xl font-bold uppercase tracking-tight text-white sm:text-6xl">
            Empezá a gestionar tu tienda hoy mismo
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
            Creá tu organización en un minuto, invitá a tu equipo y cargá tu
            stock. El resto del negocio queda registrado solo.
          </p>

          <MarketingButton
            href={signupUrl()}
            variant="white"
            className="relative mt-8"
          >
            Empezá gratis
            <ArrowRight className="h-4 w-4" />
          </MarketingButton>

          <p className="relative mt-5 text-xs text-white/70">
            Sin instalación: funciona en el navegador, con los datos de tu
            organización aislados de los demás.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
