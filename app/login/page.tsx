import { AppPreviewBackdrop } from "@/components/auth/app-preview-backdrop";
import { AuthModal } from "@/components/auth/auth-modal";
import { AvisoCookies } from "@/components/legal/aviso-cookies";
import { LoginForm } from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-neutral-50 p-4">
      <AppPreviewBackdrop />
      <div className="absolute inset-0 bg-white/55" />
      <div className="relative">
        <AuthModal title="Iniciar sesión" description="Entrá a tu cuenta de Tekly">
          <LoginForm initialError={searchParams.error} />
        </AuthModal>
      </div>
      <AvisoCookies />
    </main>
  );
}
