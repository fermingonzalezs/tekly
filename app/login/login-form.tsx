"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Check } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" shape="pill" disabled={pending} className="w-full justify-center">
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
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-neutral-600">
        <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
          <input
            type="checkbox"
            name="rememberMe"
            defaultChecked
            className="peer absolute inset-0 h-4 w-4 cursor-pointer appearance-none rounded-md border border-neutral-300 bg-white transition-colors checked:border-accent checked:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
          <Check className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 peer-checked:opacity-100" />
        </span>
        Recordarme
      </label>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <SubmitButton />
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="font-medium text-accent">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
      <p className="text-center text-sm text-neutral-500">
        ¿No tenés cuenta?{" "}
        <Link href="/signup" className="font-medium text-accent">
          Creá tu organización
        </Link>
      </p>
    </form>
  );
}
