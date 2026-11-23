"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { fmtArs } from "@/lib/format";
import { PLANES, type PlanId } from "@/lib/planes";
import { cancelarSuscripcionAction, suscribirseAction } from "./actions";

/** Botón de un plan: pide el email de la cuenta de Mercado Pago y manda al
 * checkout de la suscripción. */
export function BotonSuscribirse({
  plan,
  emailInicial,
  label,
}: {
  plan: PlanId;
  emailInicial: string;
  label: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState(emailInicial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const continuar = () => {
    setError(null);
    startTransition(async () => {
      const res = await suscribirseAction(plan, email);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      window.location.href = res.url;
    });
  };

  return (
    <>
      <Button className="mt-4 w-full" variant="primary" onClick={() => setAbierto(true)}>
        {label}
      </Button>
      <Dialog
        key={abierto ? `suscribir-${plan}` : `suscribir-${plan}-none`}
        open={abierto}
        onClose={() => setAbierto(false)}
        title={`Suscribirme a ${PLANES[plan].label}`}
        size="lg"
        formulario
        footer={
          <>
            <Button variant="outline" fullOnMobile onClick={() => setAbierto(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="primary" fullOnMobile onClick={continuar} loading={pending} disabled={!email.trim()}>
              Ir a Mercado Pago
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            Débito automático de <strong>{fmtArs(PLANES[plan].precioArs!)} por mes</strong>. En
            Mercado Pago elegís cómo pagar (tarjeta o dinero en cuenta) y lo podés cancelar cuando
            quieras.
          </p>
          <Field label="Email de tu cuenta de Mercado Pago">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <p className="text-[13px] text-neutral-500">
            Usá el mismo email con el que entrás a Mercado Pago. El plan se activa apenas Mercado Pago
            confirma el pago.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Dialog>
    </>
  );
}

/** Cancela el débito automático; el plan sigue hasta el fin del período pago. */
export function CancelarSuscripcion({ hasta }: { hasta: string | null }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cancelar = () => {
    setError(null);
    startTransition(async () => {
      const res = await cancelarSuscripcionAction();
      if (res.error) {
        setError(res.error);
        return;
      }
      setAbierto(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="danger-outline" size="sm" onClick={() => setAbierto(true)}>
        Cancelar suscripción
      </Button>
      <ConfirmDialog
        open={abierto}
        onClose={() => setAbierto(false)}
        onConfirm={cancelar}
        title="Cancelar suscripción"
        confirmLabel="Cancelar suscripción"
        pending={pending}
      >
        <p>
          Se detiene el débito automático en Mercado Pago.
          {hasta ? ` Tu plan sigue activo hasta el ${hasta}; ` : " "}
          después la cuenta pasa a solo lectura: se ve todo, pero no se puede cargar nada nuevo.
        </p>
        {error && <p className="mt-2 text-red-600">{error}</p>}
      </ConfirmDialog>
    </>
  );
}
