import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/topnav";
import { Toaster } from "@/components/notifications/toaster";
import { SimPanel } from "@/components/notifications/sim-panel";

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
    <html lang="es">
      <body>
        <TopNav />
        {children}
        <Toaster />
        <SimPanel />
      </body>
    </html>
  );
}
