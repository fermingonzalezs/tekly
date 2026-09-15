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

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, formAction] = useFormState(loginAction, initialState);
  const error = state.error ?? initialError ?? null;

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Email">
        <Input name="email" type="email" required autoComplete="email" autoFocus />
      </Field>
      <Field label="Contraseña">
        <Input name="password" type="password" required autoComplete="current-password" />
      </Field>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            name="rememberMe"
            defaultChecked
            className="h-4 w-4 rounded border-neutral-300 text-accent"
          />
          Recordarme
        </label>
        <Link href="/forgot-password" className="text-sm font-medium text-accent">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
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
