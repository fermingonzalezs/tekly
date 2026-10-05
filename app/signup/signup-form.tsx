"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AuthError } from "@/components/auth/auth-error";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { LEGAL_BORRADOR } from "@/lib/legal";
import { signupAction, type SignupState } from "./actions";

const initialState: SignupState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full justify-center">
      {pending ? "Creando…" : "Crear organización"}
    </Button>
  );
}

export function SignupForm() {
  const [state, formAction] = useFormState(signupAction, initialState);

  if (state.sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent">
          <MailCheck className="h-6 w-6" />
        </div>
        <p className="text-sm text-neutral-600">
          Te mandamos un mail para confirmar tu cuenta. Abrí el link que te
          llegó para poder entrar.
        </p>
        <Link href="/login" className="text-sm font-medium text-accent">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <TurnstileWidget />
      <Field label="Nombre de la empresa">
        <Input name="organizacionNombre" required autoFocus />
      </Field>
      <Field label="Tu nombre">
        <Input name="nombre" required autoComplete="name" />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="Contraseña">
        <Input
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirmar contraseña">
        <Input
          name="confirmPassword"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
        />
      </Field>
      {!LEGAL_BORRADOR && (
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
      )}
      <AuthError message={state.error} />
      <SubmitButton />
      <p className="text-center text-sm text-neutral-500">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-medium text-accent">
          Entrá
        </Link>
      </p>
    </form>
  );
}
