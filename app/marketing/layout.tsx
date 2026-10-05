import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { SITE_URL } from "@/lib/marketing/seo";
import { AvisoCookies } from "@/components/legal/aviso-cookies";

/**
 * Layout de la landing: metadata propia de marketing (distinta a la genérica
 * del root layout). Vive fuera del grupo (app): sin requireUser, sin TopNav,
 * sin RealtimeProvider -- la middleware la resuelve por host antes de que
 * corra nada de auth.
 */

/** Fuente de headlines de la landing -- Bricolage Grotesque, scopeada SOLO
 * a marketing vía su custom property (hereda todo lo que cuelga del wrapper
 * de abajo). El dashboard interno de gestión no la ve: sus números hero
 * siguen en Space Grotesk, cargada en el root layout (app/layout.tsx) -- ver
 * plans/002-landing-fuente-headlines.md. La utilidad Tailwind que la expone
 * es `font-display` (tailwind.config.ts). */
const marketingDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-marketing-display",
  display: "swap",
});
const TITULO = "Tekly — Sistema de gestión para venta y reparación de celulares";
const DESCRIPCION =
  "Sistema de gestión para locales de celulares y servicio técnico: stock por IMEI, ventas con pago dividido, reparaciones, turnos, cajas y analíticas en tiempo real.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITULO,
  description: DESCRIPCION,
  applicationName: "Tekly",
  keywords: [
    "sistema de gestión para venta de celulares",
    "software para local de celulares",
    "gestión de reparaciones de celulares",
    "control de stock por IMEI",
    "sistema para servicio técnico de celulares",
    "punto de venta celulares Argentina",
  ],
  alternates: { canonical: "/" },
  // Pisa el `noindex` del root layout: la landing es lo único indexable.
  robots: { index: true, follow: true },
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    type: "website",
    url: SITE_URL,
    siteName: "Tekly",
    locale: "es_AR",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Tekly: gestión para locales de venta y reparación de celulares",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRIPCION,
    images: [`${SITE_URL}/og-image.png`],
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // La landing fija su propia paleta (índigo, la de marca -- lib/theme-presets.ts)
  // en vez de heredar la de getActiveTema(): si alguien con sesión de una org
  // con otra paleta entra a tekly.tech, el <html> trae SU data-tema, y la
  // marca de marketing es independiente de eso. El texto hereda Sora del
  // `<html>` (app/layout.tsx), la misma fuente que la app; los titulares usan
  // `font-display` (Bricolage). Fondo: neutral-50 + trama de puntos índigo
  // cada 22px.
  return (
    <div
      data-tema="indigo"
      className={`min-h-screen bg-[#f7f7fa] text-neutral-900 ${marketingDisplay.variable}`}
      style={{
        backgroundImage:
          "radial-gradient(rgb(var(--accent-rgb) / 0.09) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      {children}
      <AvisoCookies />
    </div>
  );
}
