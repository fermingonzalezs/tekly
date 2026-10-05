import { DemoProvider } from "@/lib/demo/store";
import { RealtimeProvider } from "@/components/notifications/realtime-provider";
import { DemoBanner } from "@/components/demo/demo-banner";
import { DemoNav } from "@/components/demo/demo-nav";

/** Shell público de la demo (plan 014): sin sesión, sin Supabase. El estado
 * vive en `sessionStorage` (ver `DemoProvider`); el realtime va sin
 * transporte (`enabled={false}`) -- nunca con el `organizationId` "demo". */
export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RealtimeProvider organizationId="demo" enabled={false}>
      <DemoProvider>
        <DemoBanner />
        <DemoNav />
        {children}
      </DemoProvider>
    </RealtimeProvider>
  );
}
