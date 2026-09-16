import { AppPreviewBackdrop } from "@/components/auth/app-preview-backdrop";
import { AuthModal } from "@/components/auth/auth-modal";
import { HashCallback } from "./hash-callback";

/** Pantalla puente para los links de mail cuya sesión vuelve en el fragmento
 * de la URL -- ver `app/auth/confirm/route.ts`. */
export default function AuthHashPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-neutral-50 p-4">
      <AppPreviewBackdrop />
      <div className="absolute inset-0 bg-white/55" />
      <div className="relative">
        <AuthModal title="Verificando" description="Un momento, estamos validando tu link">
          <HashCallback next={searchParams.next ?? null} />
        </AuthModal>
      </div>
    </main>
  );
}
