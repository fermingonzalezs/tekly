import { AppPreviewBackdrop } from "@/components/auth/app-preview-backdrop";
import { AuthModal } from "@/components/auth/auth-modal";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-neutral-50 p-4">
      <AppPreviewBackdrop />
      <div className="absolute inset-0 bg-white/55" />
      <div className="relative">
        <AuthModal title="Recuperar contraseña" description="Te mandamos un link por mail">
          <ForgotPasswordForm />
        </AuthModal>
      </div>
    </main>
  );
}
