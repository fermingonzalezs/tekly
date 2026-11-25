"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AuthError } from "@/components/auth/auth-error";
import { bienvenidaAction, type BienvenidaState } from "./actions";

const initialState: BienvenidaState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} className="w-full justify-center">
      Crear cuenta y entrar
    </Button>
  );
}

/** Alta del invitado: confirma el nombre que cargó el admin y elige su
 * contraseña (mismas reglas que el signup). */
export function BienvenidaForm({ nombre, email }: { nombre: string; email: string }) {
  const [state, formAction] = useFormState(bienvenidaAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Email">
        <Input value={email} disabled readOnly autoComplete="username" />
      </Field>
      <Field label="Tu nombre">
        <Input name="nombre" defaultValue={nombre} required minLength={2} autoComplete="name" />
      </Field>
      <Field label="Contraseña">
        <Input
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          autoFocus
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
      <p className="text-xs text-neutral-500">
        Mínimo 12 caracteres. Con este email y esta contraseña vas a entrar a
        Tekly de ahora en más.
      </p>
      <AuthError message={state.error} />
      <SubmitButton />
    </form>
  );
}
