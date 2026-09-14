import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={spaceGrotesk.variable}>
      <body>{children}</body>
    </html>
  );
}
