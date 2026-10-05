import type { Metadata } from "next";
import { Space_Grotesk, Sora } from "next/font/google";
import { getActiveTema } from "@/lib/theme";
import "./globals.css";

// Fuente de los números grandes (KPIs del dashboard). Se expone como CSS var
// y se usa vía la utilidad `font-grotesk` de Tailwind.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

// Fuente del texto de TODA la app y de la landing (cuerpo, tablas, botones,
// formularios). Es una variable font (un solo archivo, pesos 100-800): se
// expone como CSS var y la usan el `body` (app/globals.css) y la utilidad
// `font-sans` de Tailwind. Los titulares de la landing siguen en Bricolage
// (`font-display`) y los números hero del dashboard en Space Grotesk
// (`font-grotesk`).
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  // Favicons del kit de marca (public/tekly-logo-kit, ver CLAUDE.md → "Marca"):
  // .ico de 16/32 px de respaldo, SVG simplificado para navegadores modernos
  // y apple-touch-icon de 180 px.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/tekly-logo-kit/tekly-favicon-32.svg", type: "image/svg+xml" },
    ],
    apple: "/tekly-logo-kit/png/tekly-icono-180.png",
  },
  title: "Tekly",
  description: "CRM de gestión para venta y reparación de iPhones",
  // La app de gestión (sistema.tekly.tech) no se indexa: todo lo que cuelga
  // de acá requiere sesión. Solo la landing (app/marketing/layout.tsx) pisa
  // esto con `index: true`.
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tema = await getActiveTema();
  return (
    // data-tema en <html> (no en un div de (app)/layout.tsx): ReciboImprimir
    // porta el recibo a document.body vía createPortal, FUERA del árbol de
    // (app) -- en un div más adentro el recibo impreso no heredaría las
    // CSS vars y saldría siempre en índigo.
    <html
      lang="es-AR"
      className={`${spaceGrotesk.variable} ${sora.variable}`}
      data-tema={tema}
    >
      <body>{children}</body>
    </html>
  );
}
