import { MarketingNav } from "@/components/marketing/nav";
import { MarketingHero } from "@/components/marketing/hero";
import { MarketingLogosStrip } from "@/components/marketing/logos-strip";
import { MarketingModules } from "@/components/marketing/modules";
import { MarketingAnaliticas } from "@/components/marketing/analiticas";
import { MarketingHowItWorks } from "@/components/marketing/how-it-works";
import { MarketingPricing } from "@/components/marketing/pricing";
import { MarketingCtaFinal } from "@/components/marketing/cta-final";
import { MarketingFooter } from "@/components/marketing/footer";
import { jsonLdLanding } from "@/lib/marketing/seo";

/**
 * Landing de Tekly: tekly.tech/ llega acá por rewrite del middleware (el
 * usuario nunca ve /marketing en la barra). Server component puro -- ensambla
 * secciones estáticas, sin sesión ni datos.
 */
export default function MarketingPage() {
  return (
    <div className="min-h-screen overflow-x-clip">
      <script
        type="application/ld+json"
        // JSON-LD estático (lib/marketing/seo.ts), sin datos de usuario.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdLanding()) }}
      />
      <MarketingNav />
      <main>
        <MarketingHero />
        <MarketingLogosStrip />
        <MarketingModules />
        <MarketingAnaliticas />
        <MarketingHowItWorks />
        <MarketingPricing />
        <MarketingCtaFinal />
      </main>
      <MarketingFooter />
    </div>
  );
}
