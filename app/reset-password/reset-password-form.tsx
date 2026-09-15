"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { resetPasswordAction, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full justify-center">
      {pending ? "Guardando…" : "Guardar contraseña"}
    </Button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useFormState(resetPasswordAction, initialState);

  if (state.done) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <p className="text-sm text-neutral-600">
          Listo, tu contraseña se actualizó.
        </p>
        <Link href="/" className="text-sm font-medium text-accent">
          Entrar a Tekly
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Nueva contraseña">
        <Input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          autoFocus
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
      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
