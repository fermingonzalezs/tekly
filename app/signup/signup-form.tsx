"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import Script from "next/script";
import { MailCheck } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AuthError } from "@/components/auth/auth-error";
import { signupAction, type SignupState } from "./actions";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const initialState: SignupState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" shape="pill" disabled={pending} className="w-full justify-center">
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
      {TURNSTILE_SITE_KEY && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="afterInteractive"
            async
            defer
          />
          {/* El script de Cloudflare renderiza el widget acá adentro y mete
           * un input oculto `cf-turnstile-response` -- viaja solo con el
           * resto del FormData porque está dentro del <form>. Sin
           * NEXT_PUBLIC_TURNSTILE_SITE_KEY configurada, este bloque entero
           * no se renderiza y el signup sigue funcionando igual que antes
           * (Supabase ignora un captchaToken ausente si el captcha no está
           * prendido en el dashboard). */}
          <div
            className="cf-turnstile"
            data-sitekey={TURNSTILE_SITE_KEY}
            data-refresh-expired="auto"
          />
        </>
      )}
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
          minLength={8}
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirmar contraseña">
        <Input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>
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
