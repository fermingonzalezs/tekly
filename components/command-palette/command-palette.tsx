"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import type { Rol } from "@/lib/auth/types";
import type { QuickAction } from "@/lib/command-palette";
import { filterQuickActions, quickActionsForRole } from "@/lib/command-palette";
import { lockScroll, unlockScroll } from "@/components/ui/dialog";

export function CommandPalette({ rol }: { rol: Rol }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filtered = useMemo(
    () => filterQuickActions(quickActionsForRole(rol), query),
    [rol, query],
  );

  // Reset al reabrir -- mismo criterio que los dialogs con key={...}.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlightedIndex(0);
  }, [open]);

  // Scroll lock mientras está abierto, sobre el mismo contador global que
  // Dialog -- soporta palette abierta sobre un dialog sin liberar el scroll.
  useEffect(() => {
    if (!open) return;
    lockScroll();
    return () => unlockScroll();
  }, [open]);

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
        setHighlightedIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const action = filtered[highlightedIndex];
        if (action) {
          setOpen(false);
          router.push(action.href);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, highlightedIndex, router]);

  function seleccionar(action: QuickAction) {
    setOpen(false);
    router.push(action.href);
  }

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
          className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto mt-[12vh] w-full max-w-lg px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  placeholder="Buscar una acción…"
                  className="h-12 w-full bg-transparent pl-11 pr-4 text-sm outline-none placeholder:text-neutral-400"
                />
              </div>
              <div className="max-h-80 overflow-y-auto border-t border-neutral-100">
                {filtered.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-500">
                    Sin resultados
                  </p>
                ) : (
                  filtered.map((action, i) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        onClick={() => seleccionar(action)}
                        className={
                          "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm" +
                          (i === highlightedIndex ? " bg-accent-soft" : "")
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0 text-neutral-500" />
                        {action.label}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-500">
                ↑↓ para navegar · Enter para elegir · Esc para cerrar
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
