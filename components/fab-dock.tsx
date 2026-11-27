"use client";

import { useEffect, useRef, useState } from "react";
import { Bug, ChevronLeft, ChevronRight, Search, ShoppingCart } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { ReportarBugFab } from "@/components/reportar-bug-fab";
import { PanelCarrito, useCarritoVenta } from "@/components/ventas/carrito-venta";
import type { Rol } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

const CLAVE_OCULTO = "tekly:ui:fab-dock";

/** Botones flotantes de la app, en una sola píldora vertical abajo a la
 * derecha: "Reportar un problema" (chico, arriba) y "Buscar o crear" (el
 * principal, redondo en `accent`, abajo). Los diálogos que abren van como
 * hermanos del wrapper fixed -- anidados quedarían atrapados en su stacking
 * context y pintarían debajo de otros fixed z-50. El reporte se oculta en
 * mobile: ahí compite con los demás controles fixed (nav, toasts).
 *
 * Como tapa botones de la página que caen abajo a la derecha, se aparta:
 * - a mano, con la flecha de arriba: queda una pestaña chica pegada al borde
 *   (persistido en `localStorage`, `tekly:ui:fab-dock`); Ctrl K sigue
 *   abriendo el buscador igual.
 * - solo, mientras se scrollea hacia abajo (vuelve al scrollear para arriba).
 */
export function FabDock({ roles }: { roles: Rol[] }) {
  const [paletaAbierta, setPaletaAbierta] = useState(false);
  const [bugAbierto, setBugAbierto] = useState(false);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const { carrito } = useCarritoVenta();
  const [oculto, setOculto] = useState(false);
  const [bajando, setBajando] = useState(false);
  const ultimoScroll = useRef(0);
  const dockRef = useRef<HTMLDivElement>(null);

  // Oculto a mano = fuera del orden de foco (`inert` como atributo: React 18
  // no lo maneja como prop booleana).
  useEffect(() => {
    dockRef.current?.toggleAttribute("inert", oculto);
  }, [oculto]);

  useEffect(() => {
    try {
      setOculto(localStorage.getItem(CLAVE_OCULTO) === "1");
    } catch {
      // sin localStorage: queda visible.
    }
  }, []);

  useEffect(() => {
    ultimoScroll.current = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const delta = y - ultimoScroll.current;
      // Umbral chico para que un temblor del trackpad no lo haga parpadear.
      if (Math.abs(delta) < 8) return;
      setBajando(delta > 0 && y > 40);
      ultimoScroll.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function cambiarOculto(valor: boolean) {
    setOculto(valor);
    try {
      localStorage.setItem(CLAVE_OCULTO, valor ? "1" : "0");
    } catch {
      // idem
    }
  }

  // El carrito abierto lo mantiene a la vista (el panel se ancla a él).
  const apartado = !carritoAbierto && (oculto || bajando);

  return (
    <>
      {oculto && (
        <button
          type="button"
          aria-label="Mostrar buscador y botones flotantes"
          title="Mostrar buscador (Ctrl K)"
          onClick={() => cambiarOculto(false)}
          className="fixed bottom-8 right-0 z-40 grid h-11 w-6 place-items-center rounded-l-lg border border-r-0 border-neutral-200 bg-white text-neutral-500 shadow-md transition-colors duration-150 hover:bg-accent-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      <div
        aria-hidden={oculto || undefined}
        ref={dockRef}
        className={cn(
          "fixed bottom-6 right-6 z-40 flex flex-col items-center gap-1 rounded-full border border-neutral-200 bg-white p-1.5 shadow-lg transition-transform duration-200 ease-out",
          apartado && "pointer-events-none translate-x-[calc(100%+2rem)]",
        )}
      >
        <IconButton
          aria-label="Ocultar buscador y botones flotantes"
          title="Ocultar (Ctrl K sigue abriendo el buscador)"
          icon={ChevronRight}
          variant="ghost"
          size="sm"
          onClick={() => cambiarOculto(true)}
        />
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
