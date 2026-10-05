"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { signupUrl } from "@/lib/marketing/app-url";
import { useDemo } from "@/lib/demo/store";

/** Franja de la demo (plan 014): aviso de datos efímeros + reiniciar + CTA. */
export function DemoBanner() {
  const { reiniciar } = useDemo();
  const [confirmar, setConfirmar] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-b border-accent/20 bg-accent-soft px-4 py-2 text-center text-xs text-neutral-700">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
          Estás en la demo — los datos se guardan solo en esta pestaña.
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirmar(true)}>
            Reiniciar demo
          </Button>
          <ButtonLink href={signupUrl()} variant="primary" size="sm">
            Crear cuenta gratis
          </ButtonLink>
        </div>
      </div>

      <ConfirmDialog
        open={confirmar}
        onClose={() => setConfirmar(false)}
        onConfirm={() => {
          reiniciar();
          setConfirmar(false);
        }}
        title="¿Reiniciar la demo?"
        confirmLabel="Reiniciar"
      >
        Se vuelven a cargar los datos de ejemplo. Perdés los cambios que hayas
        hecho en esta pestaña.
      </ConfirmDialog>
    </>
  );
}
