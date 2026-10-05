import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { signOutAction } from "@/app/(app)/actions";
import { TeklyLogo } from "@/components/brand/tekly-logo";

export const metadata: Metadata = {
  title: "Panel de plataforma · Tekly",
};

/** Layout de `/admin` -- FUERA del grupo `(app)` a propósito: ese layout
 * fuerza `TopNav` + `RealtimeProvider` de una sola organización, que no tiene
 * sentido para un panel cross-org. Acá el shell es mínimo: header con título
 * + volver a la app + logout. El gate de identidad vive en este layout (todo
 * lo que cuelga de `/admin` pasa por acá), mismo criterio que
 * `requireRole("admin")` en Configuración -- el middleware no se toca (ver
 * plans/001-panel-admin-plataforma.md). */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformAdmin();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[100rem] items-center gap-3 px-4 sm:px-8">
          <TeklyLogo variante="icono" altura={32} alt="" className="shrink-0" />
          <span className="font-grotesk text-lg font-semibold text-neutral-900">
            Tekly · Panel de plataforma
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-full px-3 py-2 text-[13px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              Volver a la app
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-full px-3 py-2 text-[13px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[100rem] p-4 md:p-8">{children}</main>
    </div>
  );
}
