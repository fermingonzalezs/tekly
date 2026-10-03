import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";

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
  weight: ["400", "500", "600", "700"],
  variable: "--font-marketing-display",
  display: "swap",
});
export const metadata: Metadata = {
  metadataBase: new URL("https://tekly.tech"),
  title: "Tekly — Gestión integral para venta de celulares y tecnología",
  description:
    "Empezá a registrar las operaciones diarias ahora, para llevar tu negocio al siguiente nivel.",
  openGraph: {
    title: "Tekly — Gestión integral para venta de celulares y tecnología",
    description:
      "Empezá a registrar las operaciones diarias ahora, para llevar tu negocio al siguiente nivel.",
    type: "website",
    url: "https://tekly.tech",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Tekly" }],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // La landing fija su propia paleta (violeta, lib/theme-presets.ts) en vez
  // de heredar "indigo" default de getActiveTema() -- no hay sesión acá para
  // resolver una organización, y la marca de marketing es independiente de
  // qué paleta haya elegido cada negocio dentro de la app.
  return (
    <div
      data-tema="violeta"
      className={`min-h-screen bg-neutral-50 ${marketingDisplay.variable}`}
    >
      {children}
    </div>
  );
}
