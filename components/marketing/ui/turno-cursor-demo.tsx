"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotionSafe } from "./use-reduced-motion";

/**
 * Micro-animación en loop en un hueco libre del mockup de Turnos: un
 * cursor "entra", clickea, se abre una miniatura del dialog real de
 * "Agendar turno" (mismo header accent + "Información general" + Cliente/
 * Motivo + footer Cancelar/Agendar que `turnos-client.tsx`) y al cerrarse
 * el turno queda agendado. Vive en una celda central de la grilla (no en
 * el borde) para no quedar tapado por la tarjeta de vidrio del hero, que
 * se superpone al mockup del lado izquierdo.
 *
 * El modal necesita flotar centrado sobre TODO el mockup, no solo sobre
 * su celda -- como esta celda es un hijo chico dentro de la grilla, el
 * modal se monta vía portal dentro de `#mockup-turnos-root` (el root de
 * `MockupTurnos`, que tiene `position: relative`), así queda centrado en
 * la tarjeta entera en vez de recortado en la celda de 12px.
 *
 * Con `prefers-reduced-motion` no se monta nada de esto -- la celda queda
 * en su estado "vacía" de siempre (el "+" punteado), sin cursor ni modal.
 */

type Stage = "empty" | "arriving" | "clicked" | "modal" | "booked" | "leaving";

const TIMINGS: Record<Stage, number> = {
  empty: 1800,
  arriving: 550,
  clicked: 350,
  modal: 1300,
  booked: 2600,
  leaving: 500,
};

const ORDER: Stage[] = ["empty", "arriving", "clicked", "modal", "booked", "leaving"];

function MiniAgendarModal() {
  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center bg-neutral-900/10 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="w-[70%] max-w-[220px] overflow-hidden rounded-lg bg-white shadow-xl"
        initial={{ opacity: 0, scale: 0.9, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <div className="bg-table-header px-2.5 py-1.5">
          <p className="text-[7px] font-bold uppercase tracking-wide text-white">
            Agendar turno
          </p>
          <p className="text-[5.5px] text-white/70">Mar · 6 oct</p>
        </div>
        <div className="space-y-1.5 px-2.5 py-2">
          <p className="border-b border-neutral-200 pb-1 text-[5px] font-semibold uppercase tracking-wider text-neutral-500">
            Información general
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <p className="text-[4.5px] font-semibold uppercase text-neutral-400">
                Cliente
              </p>
              <div className="mt-0.5 rounded border border-neutral-200 px-1 py-0.5 text-[5.5px] text-neutral-700">
                Camila T.
              </div>
            </div>
            <div>
              <p className="text-[4.5px] font-semibold uppercase text-neutral-400">
                Motivo
              </p>
              <div className="mt-0.5 rounded border border-neutral-200 px-1 py-0.5 text-[5.5px] text-neutral-700">
                Compra equipo
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-1 border-t border-neutral-100 px-2.5 py-1.5">
          <span className="rounded-full border border-neutral-200 px-1.5 py-0.5 text-[5px] font-semibold text-neutral-500">
            Cancelar
          </span>
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[5px] font-semibold text-white">
            Agendar
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function TurnoCursorDemo({
  nombre,
  tipoDot,
}: {
  nombre: string;
  tipoDot: string;
}) {
  const reduced = useReducedMotionSafe();
  const [stage, setStage] = useState<Stage>("empty");
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.getElementById("mockup-turnos-root"));
  }, []);

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => {
      const i = ORDER.indexOf(stage);
      setStage(ORDER[(i + 1) % ORDER.length]);
    }, TIMINGS[stage]);
    return () => clearTimeout(t);
  }, [stage, reduced]);

  if (reduced) {
    return (
      <div className="flex h-3 items-center justify-center rounded border border-dashed border-neutral-200 text-[5.5px] text-neutral-300">
        +
      </div>
    );
  }

  const filled = stage === "booked";
  const cursorVisible = stage === "arriving" || stage === "clicked";
  const hinting = stage === "empty";

  return (
    <div className="relative h-3 overflow-visible">
      {!filled ? (
        <div
          className={`flex h-3 items-center justify-center rounded border text-[5.5px] ${
            hinting
              ? "border-accent/50 bg-accent-soft text-accent"
              : "border-dashed border-neutral-200 text-neutral-300"
          }`}
        >
          +
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex items-start gap-1 rounded bg-neutral-100 px-1 py-[3px]"
        >
          <span className={`mt-[1.5px] h-1 w-1 shrink-0 rounded-full ${tipoDot}`} />
          <span className="truncate text-[5.5px] font-semibold text-neutral-900">
            {nombre}
          </span>
        </motion.div>
      )}

      {cursorVisible && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -right-2 -top-3 z-20"
          initial={{ opacity: 0, x: 10, y: -10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {stage === "clicked" && (
            <motion.span
              className="absolute left-0 top-0 h-3.5 w-3.5 rounded-full bg-accent/50"
              initial={{ opacity: 0.7, scale: 0.4 }}
              animate={{ opacity: 0, scale: 2.2 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          )}
          <motion.svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 text-accent drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
            animate={stage === "clicked" ? { scale: 0.8 } : { scale: 1 }}
            transition={{ duration: 0.12 }}
          >
            <path
              d="M1.5 1 L1.5 13.5 L4.8 10.6 L7 15 L9 14.1 L6.8 9.7 L11 9.3 Z"
              fill="currentColor"
              stroke="white"
              strokeWidth="1"
            />
          </motion.svg>
        </motion.div>
      )}

      {portalRoot &&
        createPortal(
          <AnimatePresence>
            {stage === "modal" && <MiniAgendarModal />}
          </AnimatePresence>,
          portalRoot,
        )}
    </div>
  );
}
