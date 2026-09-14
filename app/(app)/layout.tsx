import { requireUser } from "@/lib/auth";
import { TopNav } from "@/components/topnav";
import { Toaster } from "@/components/notifications/toaster";
import { SimPanel } from "@/components/notifications/sim-panel";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <>
      <TopNav user={user} />
      {children}
      <Toaster />
      <SimPanel />
    </>
  );
}
