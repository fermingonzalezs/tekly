import { requireUser } from "@/lib/auth";
import { TopNav } from "@/components/topnav";
import { Toaster } from "@/components/notifications/toaster";
import { SimPanel } from "@/components/notifications/sim-panel";
import { RealtimeProvider } from "@/components/notifications/realtime-provider";
import { ReportarBugFab } from "@/components/reportar-bug-fab";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <RealtimeProvider organizationId={user.organizationId}>
      <TopNav user={user} />
      {children}
      <Toaster esAdmin={user.rol === "admin"} />
      <SimPanel />
      <ReportarBugFab />
    </RealtimeProvider>
  );
}
