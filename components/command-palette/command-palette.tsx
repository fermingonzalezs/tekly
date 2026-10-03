"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Loader2,
  Plus,
  Search,
  ShoppingCart,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Rol } from "@/lib/auth/types";
import {
  filterNavItems,
  filterQuickActions,
  quickActionsForRole,
} from "@/lib/command-palette";
import { navForRole } from "@/lib/nav";
import type {
  ResultadoBusqueda,
  ResultadoBusquedaTipo,
} from "@/lib/db/busqueda";
import { buscarGlobalAction } from "@/app/(app)/actions";
import { lockScroll, unlockScroll } from "@/components/ui/dialog";

const DEBOUNCE_MS = 300;
const QUERY_MIN = 2;

/** Orden y presentación de las secciones de datos en vivo -- una sección por
 * tipo de `ResultadoBusqueda` que haya traído la búsqueda, en este orden. */
const TIPOS: {
  tipo: ResultadoBusquedaTipo;
  label: string;
  icon: LucideIcon;
}[] = [
  { tipo: "cliente", label: "Clientes", icon: Users },
  { tipo: "venta", label: "Ventas", icon: ShoppingCart },
  { tipo: "ticket", label: "Reparaciones", icon: Wrench },
  { tipo: "equipo", label: "Equipos", icon: Boxes },
  { tipo: "movimiento_caja", label: "Movimientos de caja", icon: Wallet },
];

type Item = {
  key: string;
  icon: LucideIcon;
  titulo: string;
  subtitulo?: string;
  href: string;
  /** Índice en la lista aplanada -- el elevador de teclado recorre esa, no
   * las secciones por separado. */
  index: number;
};

export function CommandPalette({ rol }: { rol: Rol }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [buscando, startBusquedaTransition] = useTransition();
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const navItems = useMemo(
    () => filterNavItems(navForRole(rol), query),
    [rol, query],
  );
  const actions = useMemo(
    () => filterQuickActions(quickActionsForRole(rol), query),
    [rol, query],
  );

  const porTipo = useMemo(() => {
    const map = new Map<ResultadoBusquedaTipo, ResultadoBusqueda[]>();
    for (const r of resultados) {
      const arr = map.get(r.tipo) ?? [];
      arr.push(r);
      map.set(r.tipo, arr);
    }
    return map;
  }, [resultados]);

  // Reset al reabrir -- mismo criterio que los dialogs con key={...}.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlightedIndex(0);
    setResultados([]);
  }, [open]);

  // Scroll lock mientras está abierto, sobre el mismo contador global que
  // Dialog -- soporta palette abierta sobre un dialog sin liberar el scroll.
  useEffect(() => {
    if (!open) return;
    lockScroll();
    return () => unlockScroll();
  }, [open]);

  // Debounce de la búsqueda global: dispara `buscarGlobalAction` solo con
  // 2+ caracteres; con menos, los resultados en vivo se limpian y quedan
  // solo los locales (nav + acciones rápidas), sin red. El flag `cancelado`
  // descarta respuestas de queries viejas que llegan tarde.
  useEffect(() => {
    const q = query.trim();
    if (q.length < QUERY_MIN) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    const t = setTimeout(() => {
      startBusquedaTransition(async () => {
        try {
          const res = await buscarGlobalAction(q);
          if (!cancelado) setResultados(res);
        } catch {
          if (!cancelado) setResultados([]);
        }
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [query]);

  // Secciones: "Ir a" (nav por rol) + "Acciones rápidas" + una por tipo con
  // resultados en vivo. Cada item lleva su índice en la lista aplanada.
  const secciones: { titulo: string; items: Item[] }[] = [];
  let idx = 0;
  const conIndice = (items: Omit<Item, "index">[]): Item[] =>
    items.map((it) => ({ ...it, index: idx++ }));
  if (navItems.length > 0) {
    secciones.push({
      titulo: "Ir a",
      items: conIndice(
        navItems.map((n) => ({
          key: `nav-${n.href}`,
          icon: n.icon,
          titulo: n.label,
          href: n.href,
        })),
      ),
    });
  }
  if (actions.length > 0) {
    secciones.push({
      titulo: "Acciones rápidas",
      items: conIndice(
        actions.map((a) => ({
          key: `action-${a.id}`,
          icon: a.icon,
          titulo: a.label,
          href: a.href,
        })),
      ),
    });
  }
  for (const { tipo, label, icon } of TIPOS) {
    const rs = porTipo.get(tipo);
    if (!rs?.length) continue;
    secciones.push({
      titulo: label,
      items: conIndice(
        rs.map((r) => ({
          key: `${tipo}-${r.id}`,
          icon,
          titulo: r.titulo,
          subtitulo: r.subtitulo,
          href: r.href,
        })),
      ),
    });
  }
  const flat = secciones.flatMap((s) => s.items);

  // El highlight nunca puede quedar más allá de la lista (resultados que
  // vienen/ cambian mientras se navega).
  useEffect(() => {
    setHighlightedIndex((i) => Math.min(i, Math.max(flat.length - 1, 0)));
  }, [flat.length]);

  // Con resultados en vivo la lista supera el alto visible: el item
  // resaltado por teclado tiene que entrar en pantalla.
  useEffect(() => {
    itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  // Atajo Cmd/Ctrl+K siempre disponible; el resto de las teclas solo con
  // el buscador abierto. Es el único keydown a nivel window de la app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flat[highlightedIndex];
        if (item) {
          setOpen(false);
          router.push(item.href);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, highlightedIndex, router]);

  function seleccionar(item: Item) {
    setOpen(false);
    router.push(item.href);
  }

  const mostrandoResultadosVivos = query.trim().length >= QUERY_MIN;

  return (
    <>
      {/* El overlay va como hermano del wrapper fixed, no anidado -- mismo
          patrón que ReportarBugFab: anidado quedaría atrapado en su
          stacking context y pintaría debajo de otros fixed z-50. */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setOpen(true)}
          aria-label="Buscar una acción"
          className="grid h-14 w-14 place-items-center rounded-full bg-[linear-gradient(180deg,var(--chart-3),var(--chart-2))] text-white shadow-lg transition-all hover:brightness-95 active:brightness-90"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-neutral-900/30 backdrop-blur-md backdrop-saturate-150"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto mt-[12vh] w-full max-w-lg px-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* "Liquid glass": panel translúcido con blur fuerte + highlight
                blanco sutil arriba (ring) + sombra difusa, sin borde duro.
                El texto encima va en neutral-900/500, legible sobre el blur. */}
            <div className="overflow-hidden rounded-2xl bg-white/70 shadow-[0_8px_40px_rgba(0,0,0,0.25)] ring-1 ring-white/60 backdrop-blur-xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  placeholder="Buscar secciones, acciones, clientes, ventas…"
                  className="h-12 w-full bg-transparent pl-11 pr-11 text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                />
                {buscando && mostrandoResultadosVivos && (
                  <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-neutral-500" />
                )}
              </div>
              <div className="max-h-80 overflow-y-auto border-t border-white/60">
                {flat.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-500">
                    Sin resultados
                  </p>
                ) : (
                  secciones.map((seccion) => (
                    <div key={seccion.titulo}>
                      <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                        {seccion.titulo}
                      </p>
                      {seccion.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.key}
                            ref={(el) => {
                              itemRefs.current[item.index] = el;
                            }}
                            onClick={() => seleccionar(item)}
                            onMouseEnter={() => setHighlightedIndex(item.index)}
                            className={
                              "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm" +
                              (item.index === highlightedIndex
                                ? " bg-accent-soft"
                                : "")
                            }
                          >
                            <Icon className="h-4 w-4 shrink-0 text-neutral-500" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-neutral-900">
                                {item.titulo}
                              </span>
                              {item.subtitulo && (
                                <span className="block truncate text-xs text-neutral-500">
                                  {item.subtitulo}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-white/60 px-4 py-2 text-[11px] text-neutral-500">
                ↑↓ para navegar · Enter para elegir · Esc para cerrar
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
