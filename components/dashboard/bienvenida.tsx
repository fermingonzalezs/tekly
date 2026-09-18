"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PASOS_ONBOARDING, onboardingCompleto, type OnboardingPasoId } from "@/lib/onboarding";
import { setOnboardingPasosAction } from "@/app/(app)/dashboard/actions";
import { cn } from "@/lib/utils";
import type { Negocio } from "@/lib/db/configuracion";

export function Bienvenida({ negocio }: { negocio: Negocio }) {
  const router = useRouter();
  const [pasos, setPasos] = useState(negocio.onboardingPasos);
  const [celebrando, setCelebrando] = useState(false);
  const [, startTransition] = useTransition();

  function toggle(id: OnboardingPasoId, hecho: boolean) {
    const next = { ...pasos, [id]: hecho };
    setPasos(next);
    startTransition(() => {
      setOnboardingPasosAction(next);
    });
    if (onboardingCompleto(next)) {
      setCelebrando(true);
      setTimeout(() => router.refresh(), 1600);
    }
  }

  return (
    <Section title="Dashboard">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-neutral-900">
            ¡Bienvenido a {negocio.nombre}!
          </h1>
          <p className="text-sm text-neutral-500">
            Estos son los primeros pasos para dejar tu cuenta lista.
          </p>
        </div>

        <Card className="overflow-hidden">
          {PASOS_ONBOARDING.map((paso) => {
            const hecho = pasos[paso.id] ?? false;
            const Icon = paso.icon;
            return (
              <div
                key={paso.id}
                className="flex items-start gap-3 border-t border-neutral-100 px-5 py-4 first:border-t-0"
              >
                <input
                  type="checkbox"
                  checked={hecho}
                  onChange={(e) => toggle(paso.id, e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-neutral-300 text-accent"
                />
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      hecho ? "text-neutral-400 line-through" : "text-neutral-900",
                    )}
                  >
                    {paso.titulo}
                  </p>
                  <p className="text-[13px] text-neutral-500">{paso.descripcion}</p>
                </div>
                <Link
                  href={paso.href}
                  className="flex h-8 shrink-0 items-center rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
                >
                  Ir
                </Link>
              </div>
            );
          })}
        </Card>

        <div className="flex items-center justify-between rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-neutral-900">¿Ya está todo listo?</p>
            <p className="text-[13px] text-neutral-500">
              Cargá tu primera venta -- el Dashboard se activa solo apenas hay una.
            </p>
          </div>
          <Button shape="pill" onClick={() => router.push("/ventas")}>
            Ir a Ventas
          </Button>
        </div>
      </div>

      {celebrando && (
        <div className="animate-celebrate-in fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-10 py-10 text-center shadow-xl">
            <div className="animate-celebrate-check flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <p className="text-lg font-semibold text-neutral-900">¡Todo listo!</p>
            <p className="text-sm text-neutral-500">Activando tu Dashboard…</p>
          </div>
        </div>
      )}
    </Section>
  );
}
