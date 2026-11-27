"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bug, Search, ShoppingCart } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { ReportarBugFab } from "@/components/reportar-bug-fab";
import {
  PanelCarrito,
  useCarritoVenta,
} from "@/components/ventas/carrito-venta";
import type { Rol } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

/** Lo que cuenta como «algo clickeable» de la página que el dock taparía. */
const CLICKEABLE =
  'button, a[href], input, select, textarea, label, summary, [role="button"], [role="tab"], [role="checkbox"]';

/** Margen del dock con el costado derecho (px), en reposo. */
const MARGEN = 12;

/** Corrimiento cuando se aparta: un cuarto de la píldora más el margen, así
 * queda pegado al costado con tres cuartos de los botones a la vista. */
const APARTADO = `translateX(calc(25% + ${MARGEN}px))`;

/** Botones flotantes de la app, en una sola píldora vertical abajo a la
 * derecha: "Reportar un problema" (chico, arriba) y "Buscar o crear" (el
 * principal, redondo en `accent`, abajo). Los diálogos que abren van como
 * hermanos del wrapper fixed -- anidados quedarían atrapados en su stacking
 * context y pintarían debajo de otros fixed z-50. El reporte se oculta en
 * mobile: ahí compite con los demás controles fixed (nav, toasts).
 *
 * Se aparta solo (sin botón de ocultar) hacia la derecha, dejando a la vista
 * tres cuartos de los botones, pegado al costado:
 * - mientras se scrollea hacia abajo (vuelve al scrollear para arriba);
 * - cuando quedaría encima de algo clickeable de la página (un botón, un
 *   link, un input): se mide con `elementsFromPoint` sobre su lugar al
 *   scrollear, al cambiar el tamaño de la ventana o el contenido.
 * Pasar el mouse por lo que queda a la vista (o enfocarlo con Tab) lo trae de
 * vuelta, y Ctrl K abre el buscador siempre. */
export function FabDock({ roles }: { roles: Rol[] }) {
  const [paletaAbierta, setPaletaAbierta] = useState(false);
  const [bugAbierto, setBugAbierto] = useState(false);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const { carrito } = useCarritoVenta();
  const [bajando, setBajando] = useState(false);
  const [tapa, setTapa] = useState(false);
  const [encima, setEncima] = useState(false);
  const ultimoScroll = useRef(0);
  const dockRef = useRef<HTMLDivElement>(null);
  const zonaRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  /** ¿Hay algo clickeable de la página debajo del lugar del dock? Mide sobre
   * su posición normal (sin el corrimiento), con una grilla de puntos. */
  const medir = useCallback(() => {
    const dock = dockRef.current;
    const zona = zonaRef.current;
    if (!dock || !zona) return;
    const ancho = dock.offsetWidth;
    const alto = dock.offsetHeight;
    // `bottom-6` = 24px de abajo; `MARGEN` del costado.
    const derecha = window.innerWidth - MARGEN;
    const abajo = window.innerHeight - 24;
    const izquierda = derecha - ancho;
    const arriba = abajo - alto;
    let hay = false;
    for (const fx of [0.15, 0.5, 0.85]) {
      for (const fy of [0.05, 0.3, 0.55, 0.8, 0.97]) {
        const x = izquierda + ancho * fx;
        const y = arriba + alto * fy;
        for (const el of document.elementsFromPoint(x, y)) {
          if (zona.contains(el)) continue;
          if (el.closest(CLICKEABLE)) {
            hay = true;
            break;
          }
        }
        if (hay) break;
      }
      if (hay) break;
    }
    setTapa(hay);
  }, []);

  useEffect(() => {
    let frame = 0;
    const programar = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(medir);
    };
    ultimoScroll.current = window.scrollY;
    function onScroll() {
      programar();
      const y = window.scrollY;
      const delta = y - ultimoScroll.current;
      // Umbral chico para que un temblor del trackpad no lo haga parpadear.
      if (Math.abs(delta) < 8) return;
      setBajando(delta > 0 && y > 40);
      ultimoScroll.current = y;
    }
    // Cambios de contenido (tablas que cargan, tabs, dialogs): con un poco
    // de espera para no medir en cada mutación.
    let espera: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      clearTimeout(espera);
      espera = setTimeout(programar, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", programar);
    programar();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(espera);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", programar);
    };
  }, [medir]);

  // Otra página: arranca visible y se vuelve a medir.
  useEffect(() => {
    setBajando(false);
    const t = setTimeout(medir, 300);
    return () => clearTimeout(t);
  }, [pathname, medir]);

  // El carrito abierto o el mouse/foco encima lo mantienen a la vista.
  const apartado = !carritoAbierto && !encima && (bajando || tapa);

  return (
    <>
      {/* Zona de hover = el dock + el margen hasta el borde: al traerlo desde
          lo que queda a la vista, el mouse sigue adentro y no parpadea. */}
      <div
        ref={zonaRef}
        onMouseEnter={() => setEncima(true)}
        onMouseLeave={() => setEncima(false)}
        onFocus={() => setEncima(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            setEncima(false);
        }}
        style={{ paddingRight: MARGEN }}
        className="fixed bottom-6 right-0 z-40"
      >
        <div
          ref={dockRef}
          style={
            apartado
              ? { transform: APARTADO }
              : undefined
          }
          className={cn(
            "flex flex-col items-center gap-1 rounded-full border border-neutral-200 bg-white p-1.5 shadow-lg transition-[transform,opacity] duration-200 ease-out",
            apartado && "opacity-70",
          )}
        >
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
      </div>

      <PanelCarrito
        open={carritoAbierto}
        onClose={() => setCarritoAbierto(false)}
      />
      <ReportarBugFab open={bugAbierto} onOpenChange={setBugAbierto} />
      <CommandPalette
        roles={roles}
        open={paletaAbierta}
        onOpenChange={setPaletaAbierta}
      />
    </>
  );
}
