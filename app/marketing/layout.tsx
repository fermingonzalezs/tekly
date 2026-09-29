import type { Metadata } from "next";

/**
 * Layout de la landing: metadata propia de marketing (distinta a la genérica
 * del root layout). Vive fuera del grupo (app): sin requireUser, sin TopNav,
 * sin RealtimeProvider -- la middleware la resuelve por host antes de que
 * corra nada de auth.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://tekly.tech"),
  title: "Tekly — Sistema de gestión para tiendas de iPhones",
  description:
    "Inventario, ventas, reparaciones, cajas y turnos en un solo lugar. El sistema pensado para negocios de venta y reparación de iPhones.",
  openGraph: {
    title: "Tekly — Sistema de gestión para tiendas de iPhones",
    description:
      "Inventario, ventas, reparaciones, cajas y turnos en un solo lugar, en tiempo real para todo tu equipo.",
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
    <div data-tema="violeta" className="min-h-screen bg-neutral-50">
      {children}
    </div>
  );
}
