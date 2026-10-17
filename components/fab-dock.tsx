"use client";

import { useState } from "react";
import { Bug, Search } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { ReportarBugFab } from "@/components/reportar-bug-fab";
import type { Rol } from "@/lib/auth/types";

/** Botones flotantes de la app, en una sola píldora vertical abajo a la
 * derecha: "Reportar un problema" (chico, arriba) y "Buscar o crear" (el
 * principal, redondo en `accent`, abajo). Los diálogos que abren van como
 * hermanos del wrapper fixed -- anidados quedarían atrapados en su stacking
 * context y pintarían debajo de otros fixed z-50. El reporte se oculta en
 * mobile: ahí compite con los demás controles fixed (nav, toasts). */
export function FabDock({ rol }: { rol: Rol }) {
  const [paletaAbierta, setPaletaAbierta] = useState(false);
  const [bugAbierto, setBugAbierto] = useState(false);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-1 rounded-full border border-neutral-200 bg-white p-1.5 shadow-lg">
        <IconButton
          aria-label="Reportar un problema"
          title="Reportar un problema"
          icon={Bug}
          variant="ghost"
          size="lg"
          className="hidden md:grid"
          onClick={() => setBugAbierto(true)}
        />
        <IconButton
          aria-label="Buscar o crear"
          title="Buscar o crear (Ctrl K)"
          icon={Search}
          variant="primary"
          size="xl"
          onClick={() => setPaletaAbierta(true)}
        />
      </div>

      <ReportarBugFab open={bugAbierto} onOpenChange={setBugAbierto} />
      <CommandPalette rol={rol} open={paletaAbierta} onOpenChange={setPaletaAbierta} />
    </>
  );
}
