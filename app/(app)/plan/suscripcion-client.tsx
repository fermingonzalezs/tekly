"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs } from "@/components/ui/tabs";
import { Field, Input } from "@/components/ui/field";
import { fmtArs } from "@/lib/format";
import {
  MESES_PAGOS_ANUAL,
  PLANES,
  PLANES_PAGOS,
  ahorroAnual,
  precioCiclo,
  type Ciclo,
  type PlanId,
} from "@/lib/planes";
import { cn } from "@/lib/utils";
import { cancelarSuscripcionAction, suscribirseAction } from "./actions";

/** Botón de un plan: pide el email de la cuenta de Mercado Pago y manda al
 * checkout de la suscripción. */
function BotonSuscribirse({
  plan,
  ciclo,
  emailInicial,
  label,
  primerCobro,
}: {
  plan: PlanId;
  ciclo: Ciclo;
  emailInicial: string;
  label: string;
  /** Fin de la prueba gratis (dd/mm), si está en curso: el primer cobro. */
  primerCobro: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState(emailInicial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const continuar = () => {
    setError(null);
    startTransition(async () => {
      const res = await suscribirseAction(plan, ciclo, email);
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
        key={abierto ? `suscribir-${plan}-${ciclo}` : `suscribir-${plan}-none`}
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
            Débito automático de{" "}
            <strong>
              {fmtArs(precioCiclo(plan, ciclo)!)} {ciclo === "anual" ? "por año" : "por mes"}
            </strong>
            . En Mercado Pago elegís cómo pagar (tarjeta o dinero en cuenta) y lo podés cancelar
            cuando quieras.
          </p>
          {primerCobro && (
            <p className="text-sm text-neutral-700">
              Tu prueba gratis sigue: <strong>el primer cobro es el {primerCobro}</strong>, cuando
              termina.
            </p>
          )}
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

/** Tarjetas de planes con selector Mensual / Anual (el anual cobra
 * `MESES_PAGOS_ANUAL` meses y regala el resto). */
export function PlanesSelector({
  planActual,
  cicloActual,
  debitoActivo,
  conMp,
  emailInicial,
  primerCobro,
}: {
  planActual: PlanId;
  cicloActual: Ciclo;
  debitoActivo: boolean;
  conMp: boolean;
  emailInicial: string;
  primerCobro: string | null;
}) {
  const [ciclo, setCiclo] = useState<Ciclo>(cicloActual);
  const mesesGratis = 12 - MESES_PAGOS_ANUAL;

  return (
    <div className="space-y-4">
      <Tabs
        value={ciclo}
        onChange={setCiclo}
        options={[
          { value: "mensual", label: "Mensual" },
          { value: "anual", label: `Anual · ${mesesGratis} meses gratis` },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLANES_PAGOS.map((id) => {
          const p = PLANES[id];
          // La prueba gratis es el plan Starter.
          const actual = planActual === id || (planActual === "trial" && id === "starter");
          const contratado = actual && debitoActivo && ciclo === cicloActual;
          return (
            <div
              key={id}
              className={cn(
                "flex flex-col rounded-2xl border p-4",
                actual ? "border-accent bg-accent-soft" : "border-neutral-200",
              )}
            >
              <p className="text-sm font-semibold text-neutral-900">{p.label}</p>
              <p className="mt-1 font-grotesk text-2xl font-semibold tabular-nums text-neutral-900">
                {fmtArs(precioCiclo(id, ciclo)!)}
                <span className="text-[13px] font-normal text-neutral-500">
                  {ciclo === "anual" ? " /año" : " /mes"}
                </span>
              </p>
              {ciclo === "anual" && (
                <p className="mt-0.5 text-[13px] text-neutral-600">
                  Equivale a {fmtArs(Math.round(precioCiclo(id, "anual")! / 12))}/mes · ahorrás{" "}
                  {fmtArs(ahorroAnual(id))}
                </p>
              )}
              <p className="mt-3 flex items-center gap-2 text-[13px] text-neutral-700">
                <Check className="h-4 w-4 text-accent" />
                {p.maxUsuarios === 1 ? "1 usuario" : `Hasta ${p.maxUsuarios} usuarios`}
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-[13px] text-neutral-700">
                <Check className="h-4 w-4 text-accent" />
                Todos los módulos
              </p>
              <div className="mt-auto">
                {actual && (
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-accent">
                    {planActual === "trial"
                      ? "En prueba gratis"
                      : contratado
                        ? `Tu plan actual · ${cicloActual}`
                        : "Tu plan actual"}
                  </p>
                )}
                {conMp && !contratado && (
                  <BotonSuscribirse
                    plan={id}
                    ciclo={ciclo}
                    emailInicial={emailInicial}
                    primerCobro={primerCobro}
                    label={debitoActivo ? "Cambiar a este plan" : "Suscribirme"}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
