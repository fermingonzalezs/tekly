import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { requiereAceptarTerminos } from "@/lib/legal";
import { getNegocio } from "@/lib/db/configuracion";
import { TopNav } from "@/components/topnav";
import { Toaster } from "@/components/notifications/toaster";
import { RealtimeProvider } from "@/components/notifications/realtime-provider";
import { ReportarBugFab } from "@/components/reportar-bug-fab";
import { CommandPalette } from "@/components/command-palette/command-palette";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, negocio] = await Promise.all([requireUser(), getNegocio()]);
  // Invitados y usuarios previos aceptan la versión vigente de Términos y
  // Privacidad al primer ingreso (solo cuando los textos ya no son borrador).
  if (requiereAceptarTerminos(user.terminosVersion)) redirect("/aceptar-terminos");

  return (
    <RealtimeProvider organizationId={user.organizationId}>
      <TopNav user={user} logoUrl={negocio.logoUrl} nombre={negocio.nombre} />
      {children}
      <Toaster esAdmin={user.rol === "admin"} />
      <ReportarBugFab />
      <CommandPalette rol={user.rol} />
    </RealtimeProvider>
  );
}
