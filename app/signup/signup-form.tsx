"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
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

  return (
    <form action={formAction} className="space-y-4">
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
      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
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
