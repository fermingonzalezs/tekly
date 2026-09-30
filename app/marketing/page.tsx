import { MarketingNav } from "@/components/marketing/nav";
import { MarketingHero } from "@/components/marketing/hero";
import { MarketingLogosStrip } from "@/components/marketing/logos-strip";
import { MarketingFeatures } from "@/components/marketing/features";
import { MarketingHowItWorks } from "@/components/marketing/how-it-works";
import { MarketingShowcase } from "@/components/marketing/showcase";
import { MarketingPricing } from "@/components/marketing/pricing";
import { MarketingCtaFinal } from "@/components/marketing/cta-final";
import { MarketingFooter } from "@/components/marketing/footer";

/**
 * Landing de Tekly: tekly.tech/ llega acá por rewrite del middleware (el
 * usuario nunca ve /marketing en la barra). Server component puro -- ensambla
 * secciones estáticas, sin sesión ni datos.
 */
export default function MarketingPage() {
  return (
    <div className="min-h-screen">
      <MarketingNav />
      <main>
        <MarketingHero />
        <MarketingLogosStrip />
        <MarketingFeatures />
        <MarketingHowItWorks />
        <MarketingShowcase />
        <MarketingPricing />
        <MarketingCtaFinal />
      </main>
      <MarketingFooter />
    </div>
  );
}
