import { Suspense } from "react";
import { redirect } from "next/navigation";
import { esAdminPlataforma, requireUser } from "@/lib/auth";
import { requiereAceptarTerminos } from "@/lib/legal";
import { getNegocio } from "@/lib/db/configuracion";
import { listResolucionesPropias } from "@/lib/db/reportes";
import { TopNav } from "@/components/topnav";
import { Toaster } from "@/components/notifications/toaster";
import { RealtimeProvider } from "@/components/notifications/realtime-provider";
import { FabDock } from "@/components/fab-dock";
import { PlanBanner } from "@/components/plan-banner";
import { VolverAlOnboardingBar } from "@/components/onboarding/volver-al-onboarding";
import { tieneRol } from "@/lib/roles";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, negocio, resoluciones] = await Promise.all([
    requireUser(),
    getNegocio(),
    // Respuestas a «Reportar un problema» para la campanita: si falla, la app
    // sigue igual (sin esas notificaciones).
    listResolucionesPropias().catch(() => []),
  ]);
  // Entró por una invitación y todavía no eligió contraseña: sin esto, el día
  // que se le cierre la sesión no tiene con qué volver a entrar.
  if (user.debeCrearContrasena) redirect("/bienvenida");
  // Invitados y usuarios previos aceptan la versión vigente de Términos y
  // Privacidad al primer ingreso (solo cuando los textos ya no son borrador).
  if (requiereAceptarTerminos(user.terminosVersion)) redirect("/aceptar-terminos");

  return (
    <RealtimeProvider organizationId={user.organizationId}>
      <TopNav
        user={user}
        logoUrl={negocio.logoUrl}
        nombre={negocio.nombre}
        adminPlataforma={esAdminPlataforma(user.email)}
        resoluciones={resoluciones}
      />
      <PlanBanner suscripcion={user.suscripcion} esAdmin={tieneRol(user, "admin")} />
      <Suspense>
        <VolverAlOnboardingBar />
      </Suspense>
      {children}
      <Toaster esAdmin={tieneRol(user, "admin")} />
      <FabDock roles={user.roles} />
    </RealtimeProvider>
  );
}
