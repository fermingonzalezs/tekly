import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Tekly",
  description: "CRM de gestión para venta y reparación de iPhones",
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
    <html lang="es" className={spaceGrotesk.variable} data-tema={tema}>
      <body>{children}</body>
    </html>
  );
}
