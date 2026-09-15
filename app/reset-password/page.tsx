import { AppPreviewBackdrop } from "@/components/auth/app-preview-backdrop";
import { AuthModal } from "@/components/auth/auth-modal";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-neutral-50 p-4">
      <AppPreviewBackdrop />
      <div className="absolute inset-0 bg-white/55" />
      <div className="relative">
        <AuthModal title="Nueva contraseña" description="Elegí una contraseña nueva">
          <ResetPasswordForm />
        </AuthModal>
      </div>
    </main>
  );
}
