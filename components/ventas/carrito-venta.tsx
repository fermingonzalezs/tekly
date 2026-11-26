"use client";

import { useEffect, useRef, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useOutsideClick } from "@/components/ui/use-outside-click";
import {
  CARRITO_KEY,
  alternarEnCarrito,
  enCarrito,
  parseCarrito,
  totalCarrito,
  type ItemCarrito,
  type TipoCarrito,
} from "@/lib/carrito-venta";

// Store mínimo sobre `sessionStorage` (vive en la pestaña, como la demo):
// el botón de cada fila y la barra se enteran de los cambios sin pasar props.
const oyentes = new Set<() => void>();
let cache: { raw: string | null; valor: ItemCarrito[] } = { raw: null, valor: [] };
const VACIO: ItemCarrito[] = [];

function leer(): ItemCarrito[] {
  const raw = sessionStorage.getItem(CARRITO_KEY);
  if (raw !== cache.raw) cache = { raw, valor: parseCarrito(raw) };
  return cache.valor;
}

function escribir(carrito: ItemCarrito[]) {
  if (carrito.length === 0) sessionStorage.removeItem(CARRITO_KEY);
  else sessionStorage.setItem(CARRITO_KEY, JSON.stringify(carrito));
  oyentes.forEach((o) => o());
}

function suscribir(o: () => void) {
  oyentes.add(o);
  return () => oyentes.delete(o);
}

/** Carrito actual (vacío en el server y en el primer render: no rompe la
 * hidratación). */
export function useCarritoVenta() {
  const carrito = useSyncExternalStore(suscribir, leer, () => VACIO);
  return {
    carrito,
    alternar: (item: ItemCarrito) => escribir(alternarEnCarrito(leer(), item)),
    vaciar: () => escribir([]),
    /** Reemplaza el carrito (ej. al pasar a la venta, sin lo no disponible). */
    guardar: escribir,
  };
}

/** Lectura directa (fuera de React): Nueva venta la usa al abrirse desde la
 * barra, en un efecto, sin esperar al primer render del store. */
export function leerCarrito(): ItemCarrito[] {
  return leer();
}

/** Vacía el carrito (después de confirmar la venta). */
export function vaciarCarrito() {
  escribir([]);
}

/** Botón 🛒 de una fila de Inventario: agrega o saca la unidad. Solo para
 * unidades disponibles (lo que «Nueva venta» puede vender). */
export function BotonCarrito({
  tipo,
  id,
  nombre,
  precioUsd,
}: {
  tipo: TipoCarrito;
  id: string;
  nombre: string;
  precioUsd: number;
}) {
  const { carrito, alternar } = useCarritoVenta();
  const dentro = enCarrito(carrito, tipo, id);
  return (
    <IconButton
      icon={ShoppingCart}
      aria-label={dentro ? `Sacar ${nombre} de la venta` : `Agregar ${nombre} a la venta`}
      title={dentro ? "Sacar de la venta" : "Agregar a la venta"}
      aria-pressed={dentro}
      variant={dentro ? "outline" : "ghost"}
      size="sm"
      className={cn(dentro && "!border-accent !bg-accent-soft !text-accent")}
      onClick={(e) => {
        e.stopPropagation();
        alternar({ tipo, id, nombre, precioUsd });
      }}
    />
  );
}

/** Panel del carrito (se abre desde el botón 🛒 del dock, junto a la lupa):
 * lista, total y «Pasar a la venta», que abre Nueva venta con todo cargado. */
export function PanelCarrito({
  open,
  onClose,
  ventasHref = "/ventas",
}: {
  open: boolean;
  onClose: () => void;
  ventasHref?: string;
}) {
  const { carrito, alternar, vaciar } = useCarritoVenta();
  const router = useRouter();
  // Ir a Ventas tarda (server render de la página): el botón muestra el
  // spinner y el panel queda abierto hasta que termina la navegación.
  const [yendo, startTransition] = useTransition();
  const fueYendo = useRef(false);
  useEffect(() => {
    if (yendo) fueYendo.current = true;
    else if (fueYendo.current) {
      fueYendo.current = false;
      onClose();
    }
  }, [yendo, onClose]);
  const ref = useOutsideClick<HTMLDivElement>(() => {
    if (!yendo) onClose();
  });
  if (!open) return null;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Venta en armado"
      className="fixed bottom-6 right-24 z-50 w-[min(26rem,calc(100vw-7rem))] rounded-2xl border border-accent/40 bg-white p-4 shadow-2xl animate-fade-in print:hidden"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="flex items-center gap-2 border-b border-neutral-100 pb-2.5">
        <ShoppingCart className="h-4 w-4 text-accent" aria-hidden="true" />
        <p className="text-sm font-semibold text-neutral-900">Venta en armado</p>
        <IconButton icon={X} aria-label="Cerrar" variant="ghost" size="sm" className="ml-auto" onClick={onClose} />
      </div>

      {carrito.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-neutral-500">
          Todavía no agregaste equipos. En Inventario, tocá 🛒 en un celular o una
          notebook disponible para sumarlo a la venta.
        </p>
      ) : (
        <>
          <ul className="max-h-64 divide-y divide-neutral-100 overflow-y-auto">
            {carrito.map((i) => (
              <li key={i.tipo + i.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate uppercase text-neutral-900">{i.nombre}</span>
                <span className="shrink-0 font-semibold tabular-nums">{fmtUsd(i.precioUsd)}</span>
                <IconButton
                  icon={X}
                  aria-label={`Sacar ${i.nombre}`}
                  variant="danger-ghost"
                  size="sm"
                  onClick={() => alternar(i)}
                />
              </li>
            ))}
          </ul>
          <div
            className="mt-2 flex items-center justify-between rounded-lg px-3 py-2"
            style={{ backgroundColor: "var(--accent-soft)" }}
          >
            <span className="text-sm font-semibold uppercase tracking-wide text-neutral-900">
              Total · {carrito.length} {carrito.length === 1 ? "equipo" : "equipos"}
            </span>
            <span className="text-sm font-semibold tabular-nums">{fmtUsd(totalCarrito(carrito))}</span>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={vaciar} disabled={yendo}>
              Vaciar
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={yendo}
              onClick={() =>
                startTransition(() => router.push(`${ventasHref}?accion=nueva-venta&carrito=1`))
              }
            >
              {yendo ? "Abriendo la venta…" : "Pasar a la venta"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
