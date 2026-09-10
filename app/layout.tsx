import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/topnav";
import { Toaster } from "@/components/notifications/toaster";
import { SimPanel } from "@/components/notifications/sim-panel";

// Fuente de los números grandes (KPIs del dashboard). Se expone como CSS var
// y se usa vía la utilidad `font-grotesk` de Tailwind.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tekly — MVP",
  description: "MVP visual de gestión para venta y reparación de iPhones",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={spaceGrotesk.variable}>
      <body>
        <TopNav />
        {children}
        <Toaster />
        <SimPanel />
      </body>
    </html>
  );
}
