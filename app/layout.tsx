import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/notifications/toaster";
import { SimPanel } from "@/components/notifications/sim-panel";

export const metadata: Metadata = {
  title: "TallerCRM — MVP",
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
        <Sidebar />
        <div className="pl-60">{children}</div>
        <Toaster />
        <SimPanel />
      </body>
    </html>
  );
}
