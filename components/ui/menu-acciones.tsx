"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { IconButton } from "@/components/ui/button";

export type AccionMenu = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
};

const MENU_W = 232;

/** Botón de tres puntos con un desplegable de acciones (columna «Acciones»
 * de las tablas). El menú se porta a `<body>` con `position: fixed`: las
 * tablas van dentro de un `Card` con `overflow-x-auto`, que recortaría un
 * dropdown absoluto. Cierra con click afuera, Esc, scroll o resize; flechas
 * arriba/abajo navegan. */
export function MenuAcciones({
  label,
  acciones,
  variant = "ghost",
}: {
  /** `aria-label` del botón, ej. «Imprimir V-1042». */
  label: string;
  acciones: AccionMenu[];
  variant?: "ghost" | "outline";
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  function abrir() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(
      Math.max(8, r.right - MENU_W),
      window.innerWidth - MENU_W - 8,
    );
    setPos({ top: r.bottom + 4, left });
  }

  // Si no entra debajo, se abre hacia arriba.
  useLayoutEffect(() => {
    if (!pos || !menuRef.current || !btnRef.current) return;
    const h = menuRef.current.offsetHeight;
    const r = btnRef.current.getBoundingClientRect();
    if (pos.top + h > window.innerHeight - 8 && r.top - h - 4 > 8) {
      setPos({ top: r.top - h - 4, left: pos.left });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const cerrar = () => setPos(null);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      cerrar();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        cerrar();
        btnRef.current?.querySelector("button")?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const btns = Array.from(
          menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
        );
        if (btns.length === 0) return;
        const i = btns.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          e.key === "ArrowDown"
            ? (i + 1) % btns.length
            : (i - 1 + btns.length) % btns.length;
        btns[next]?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
    };
  }, [open]);

  return (
    <>
      <span ref={btnRef} className="inline-flex">
        <IconButton
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          title={label}
          icon={MoreHorizontal}
          variant={variant}
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            open ? setPos(null) : abrir();
          }}
        />
      </span>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos.top, left: pos.left, width: MENU_W }}
            onClick={(e) => e.stopPropagation()}
            className="animate-menu-in fixed z-[60] rounded-lg border border-neutral-200 bg-white p-1 text-start shadow-lg"
          >
            {acciones.map((a) => (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setPos(null);
                  a.onClick();
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 focus:bg-neutral-100 focus:outline-none"
              >
                <a.icon className="h-4 w-4 text-neutral-500" />
                {a.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
