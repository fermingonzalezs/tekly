"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { forgotPasswordAction, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full justify-center">
      {pending ? "Enviando…" : "Enviar link"}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useFormState(forgotPasswordAction, initialState);

  if (state.sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent">
          <MailCheck className="h-6 w-6" />
        </div>
        <p className="text-sm text-neutral-600">
          Si ese email tiene una cuenta, te mandamos un link para elegir una
          contraseña nueva.
        </p>
        <Link href="/login" className="text-sm font-medium text-accent">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-neutral-500">
        Ingresá tu email y te mandamos un link para elegir una contraseña
        nueva.
      </p>
      <Field label="Email">
        <Input name="email" type="email" required autoComplete="email" autoFocus />
      </Field>
      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
      <SubmitButton />
      <p className="text-center text-sm text-neutral-500">
        <Link href="/login" className="font-medium text-accent">
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
