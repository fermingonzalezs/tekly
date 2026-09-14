"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full justify-center">
      {pending ? "Entrando…" : "Entrar"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Email">
        <Input name="email" type="email" required autoComplete="email" autoFocus />
      </Field>
      <Field label="Contraseña">
        <Input name="password" type="password" required autoComplete="current-password" />
      </Field>
      {state.error && (
        <p className="text-sm text-red-500">{state.error}</p>
      )}
      <SubmitButton />
      <p className="text-center text-sm text-neutral-500">
        ¿No tenés cuenta?{" "}
        <Link href="/signup" className="font-medium text-accent">
          Creá tu organización
        </Link>
      </p>
    </form>
  );
}
