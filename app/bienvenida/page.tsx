import { redirect } from "next/navigation";
import { AppPreviewBackdrop } from "@/components/auth/app-preview-backdrop";
import { AuthModal } from "@/components/auth/auth-modal";
import { requireUser } from "@/lib/auth";
import { BienvenidaForm } from "./bienvenida-form";

/** Primera pantalla de quien acepta una invitación: entra con la sesión del
 * link del mail y acá elige su contraseña (si no, el día que se le cierra la
 * sesión no tiene con qué volver a entrar). El layout `(app)` manda acá a
 * todo usuario con `debeCrearContrasena` hasta que la cree. */
export default async function BienvenidaPage() {
  const user = await requireUser();
  if (!user.debeCrearContrasena) redirect("/dashboard");

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-neutral-50 p-4">
      <AppPreviewBackdrop />
      <div className="absolute inset-0 bg-white/55" />
      <div className="relative">
        <AuthModal
          title={`Bienvenido a ${user.organizationNombre || "Tekly"}`}
          description="Creá tu contraseña para terminar de armar tu cuenta"
        >
          <BienvenidaForm nombre={user.nombre} email={user.email} />
        </AuthModal>
      </div>
    </main>
  );
}
