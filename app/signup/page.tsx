import { AppPreviewBackdrop } from "@/components/auth/app-preview-backdrop";
import { AuthModal } from "@/components/auth/auth-modal";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-neutral-50 p-4">
      <AppPreviewBackdrop />
      <div className="absolute inset-0 bg-white/55" />
      <div className="relative">
        <AuthModal title="Crear organización" description="Empezá a usar Tekly con tu equipo">
          <SignupForm />
        </AuthModal>
      </div>
    </main>
  );
}
