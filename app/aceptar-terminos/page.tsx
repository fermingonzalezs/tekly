import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { requiereAceptarTerminos } from "@/lib/legal";
import { AppPreviewBackdrop } from "@/components/auth/app-preview-backdrop";
import { AuthModal } from "@/components/auth/auth-modal";
import { Button } from "@/components/ui/button";
import { aceptarTerminosAction } from "./actions";

/** Pantalla bloqueante: invitados y usuarios que todavía no aceptaron la
 * versión vigente de los Términos/Privacidad (plan 012). `(app)/layout.tsx`
 * redirige acá; si ya aceptó, vuelve al dashboard. */
export default async function AceptarTerminosPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const user = await requireUser();
  if (!requiereAceptarTerminos(user.terminosVersion)) redirect("/dashboard");

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-neutral-50 p-4">
      <AppPreviewBackdrop />
      <div className="absolute inset-0 bg-white/55" />
      <div className="relative">
        <AuthModal
          title="Términos y privacidad"
          description="Para seguir usando Tekly, aceptá los textos vigentes"
        >
          <form action={aceptarTerminosAction} className="space-y-4">
            <label className="flex items-start gap-2 text-[13px] leading-snug text-neutral-600">
              <input
                type="checkbox"
                name="acepta"
                required
                className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--accent-rgb))]"
              />
              <span>
                Acepto los{" "}
                <Link href="/terminos" target="_blank" className="font-medium text-accent underline">
                  Términos y condiciones
                </Link>{" "}
                y la{" "}
                <Link href="/privacidad" target="_blank" className="font-medium text-accent underline">
                  Política de privacidad
                </Link>
                .
              </span>
            </label>
            {searchParams.error && (
              <p role="alert" className="text-sm text-red-600">
                No pudimos registrar la aceptación. Probá de nuevo.
              </p>
            )}
            <Button type="submit" className="w-full justify-center">
              Aceptar y continuar
            </Button>
          </form>
        </AuthModal>
      </div>
    </main>
  );
}
