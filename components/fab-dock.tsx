"use client";

import { useState } from "react";
import { Bug, Search, ShoppingCart } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { ReportarBugFab } from "@/components/reportar-bug-fab";
import { PanelCarrito, useCarritoVenta } from "@/components/ventas/carrito-venta";
import type { Rol } from "@/lib/auth/types";

/** Botones flotantes de la app, en una sola píldora vertical abajo a la
 * derecha: "Reportar un problema" (chico, arriba) y "Buscar o crear" (el
 * principal, redondo en `accent`, abajo). Los diálogos que abren van como
 * hermanos del wrapper fixed -- anidados quedarían atrapados en su stacking
 * context y pintarían debajo de otros fixed z-50. El reporte se oculta en
 * mobile: ahí compite con los demás controles fixed (nav, toasts). */
export function FabDock({ roles }: { roles: Rol[] }) {
  const [paletaAbierta, setPaletaAbierta] = useState(false);
  const [bugAbierto, setBugAbierto] = useState(false);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const { carrito } = useCarritoVenta();

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
        {/* Carrito «Vender desde el stock» (se llena con 🛒 en Inventario). */}
        <span className="relative">
          <IconButton
            aria-label={`Venta en armado${carrito.length ? ` (${carrito.length})` : ""}`}
            title="Venta en armado"
            icon={ShoppingCart}
            variant="ghost"
            size="lg"
            aria-expanded={carritoAbierto}
            // El panel se cierra con un mousedown afuera: sin frenarlo acá,
            // tocar el botón con el panel abierto lo cerraba y reabría.
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setCarritoAbierto((v) => !v)}
          />
          {carrito.length > 0 && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold tabular-nums text-white"
            >
              {carrito.length}
            </span>
          )}
        </span>
        <IconButton
          aria-label="Buscar o crear"
          title="Buscar o crear (Ctrl K)"
          icon={Search}
          variant="primary"
          size="xl"
          onClick={() => setPaletaAbierta(true)}
        />
      </div>

      <PanelCarrito open={carritoAbierto} onClose={() => setCarritoAbierto(false)} />
      <ReportarBugFab open={bugAbierto} onOpenChange={setBugAbierto} />
      <CommandPalette roles={roles} open={paletaAbierta} onOpenChange={setPaletaAbierta} />
    </>
  );
}
