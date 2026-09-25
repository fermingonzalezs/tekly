import { requireUser } from "@/lib/auth";
import { getNegocio } from "@/lib/db/configuracion";
import { TopNav } from "@/components/topnav";
import { Toaster } from "@/components/notifications/toaster";
import { RealtimeProvider } from "@/components/notifications/realtime-provider";
import { ReportarBugFab } from "@/components/reportar-bug-fab";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, negocio] = await Promise.all([requireUser(), getNegocio()]);

  return (
    <RealtimeProvider organizationId={user.organizationId}>
      <TopNav user={user} logoUrl={negocio.logoUrl} nombre={negocio.nombre} />
      {children}
      <Toaster esAdmin={user.rol === "admin"} />
      <ReportarBugFab />
    </RealtimeProvider>
  );
}
