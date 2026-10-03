"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotionSafe } from "./use-reduced-motion";

/**
 * Micro-animación en loop: un cursor clickea el buscador global (arriba,
 * como pidió el usuario) y se abre una miniatura del Cmd+K real
 * (`components/command-palette/command-palette.tsx`) con "Nueva venta"
 * resaltada en Acciones rápidas -- mismo vidrio líquido teñido de accent
 * que el real (menos blur que antes + `bg-accent/15`, no blanco neutro).
 * Al cerrarse, aparece una venta nueva arriba de la tabla. El modal se
 * monta vía portal en `#mockup-buscador-root` (root de `MockupBuscador`,
 * `position: relative`) para quedar centrado sobre toda la tarjeta.
 * Con `prefers-reduced-motion` no se monta nada -- queda el estado inicial
 * estático, sin cursor ni modal.
 */

type Stage = "idle" | "arriving" | "clicked" | "modal" | "created" | "reset";

const TIMINGS: Record<Stage, number> = {
  idle: 1800,
  arriving: 550,
  clicked: 300,
  modal: 1900,
  created: 2800,
  reset: 500,
};

const ORDER: Stage[] = ["idle", "arriving", "clicked", "modal", "created", "reset"];

// 8 filas (mismo criterio de porte que las 12 de MockupTurnos/10 de
// MockupCajas) -- las primeras 5 son ventas reales del seed
// (`lib/mock-data.ts`), el resto completa la tabla en el mismo estilo.
const VENTAS_BASE = [
  { id: "V-4821", cliente: "Juan Pérez", medio: "Transferencia", dot: "bg-blue-500", total: "U$ 735" },
  { id: "V-4820", cliente: "Sofía Ramos", medio: "Tarjeta de crédito", dot: "bg-amber-500", total: "U$ 55" },
  { id: "V-4819", cliente: "Marco Díaz", medio: "Cripto", dot: "bg-violet-500", total: "U$ 1.240" },
  { id: "V-4817", cliente: "Diego Fernández", medio: "Mercadería", dot: "bg-neutral-400", total: "U$ 410" },
  { id: "V-4815", cliente: "Valentina Cruz", medio: "Transferencia", dot: "bg-blue-500", total: "U$ 600" },
  { id: "V-4812", cliente: "Bruno Acosta", medio: "Efectivo (pesos)", dot: "bg-emerald-500", total: "U$ 320" },
  { id: "V-4809", cliente: "Camila Torres", medio: "Dólares", dot: "bg-emerald-500", total: "U$ 980" },
  { id: "V-4805", cliente: "Federico Díaz", medio: "Tarjeta de crédito", dot: "bg-amber-500", total: "U$ 145" },
];

const NUEVA_VENTA = {
  id: "V-4822",
  cliente: "Rocío Benítez",
  medio: "Transferencia",
  dot: "bg-blue-500",
  total: "U$ 690",
};

function PaletteRow({
  icon,
  titulo,
  activo,
}: {
  icon: React.ReactNode;
  titulo: string;
  activo?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1 rounded px-1.5 py-1 ${activo ? "bg-accent/15" : ""}`}
    >
      <span className="text-neutral-500">{icon}</span>
      <span className="text-[5.5px] font-medium text-neutral-900">{titulo}</span>
    </div>
  );
}

function MiniPalette() {
  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-start justify-center bg-neutral-900/15 p-4 pt-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="w-[80%] max-w-[240px] overflow-hidden rounded-lg bg-accent/15 shadow-[0_6px_24px_rgba(79,73,189,0.3)] ring-1 ring-accent/25 backdrop-blur-md"
        initial={{ opacity: 0, scale: 0.92, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <div className="flex items-center gap-1 border-b border-accent/15 px-2 py-1.5">
          <svg viewBox="0 0 24 24" className="h-[7px] w-[7px] text-neutral-400">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="text-[5.5px] text-neutral-500">nueva venta</span>
        </div>
        <div className="px-1.5 py-1.5">
          <p className="px-1 pb-0.5 text-[4.5px] font-semibold uppercase tracking-wider text-neutral-500">
            Acciones rápidas
          </p>
          <PaletteRow
            activo
            titulo="Nueva venta"
            icon={
              <svg viewBox="0 0 24 24" className="h-[7px] w-[7px]">
                <circle cx="8" cy="21" r="1" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="19" cy="21" r="1" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
          <PaletteRow
            titulo="Nuevo cliente"
            icon={
              <svg viewBox="0 0 24 24" className="h-[7px] w-[7px]">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            }
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

export function BuscadorDemo() {
  const reduced = useReducedMotionSafe();
  const [stage, setStage] = useState<Stage>("idle");
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.getElementById("mockup-buscador-root"));
  }, []);

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => {
      const i = ORDER.indexOf(stage);
      setStage(ORDER[(i + 1) % ORDER.length]);
    }, TIMINGS[stage]);
    return () => clearTimeout(t);
  }, [stage, reduced]);

  const hinting = !reduced && stage === "idle";
  const cursorVisible = !reduced && (stage === "arriving" || stage === "clicked");
  const showPalette = !reduced && stage === "modal";
  const showNueva = !reduced && (stage === "created" || stage === "reset");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative shrink-0">
        <div
          className={`flex items-center gap-1 rounded-full border px-2 py-1 transition-colors ${
            hinting ? "border-accent/60 bg-accent-soft" : "border-neutral-200 bg-white"
          }`}
        >
          <svg viewBox="0 0 24 24" className={`h-[8px] w-[8px] shrink-0 ${hinting ? "text-accent" : "text-neutral-400"}`}>
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className={`text-[5.5px] ${hinting ? "text-accent" : "text-neutral-400"}`}>
            Buscar secciones, acciones, clientes, ventas…
          </span>
        </div>

        {cursorVisible && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -right-2 -top-2.5 z-20"
            initial={{ opacity: 0, x: 10, y: -10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
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
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-hidden rounded-md border border-neutral-200">
        <div className="grid grid-cols-[32px_1fr_56px_40px]">
          <div className="bg-table-header px-1 py-1 text-center text-[5px] font-bold uppercase tracking-wide text-white">
            Venta
          </div>
          <div className="bg-table-header px-1 py-1 text-center text-[5px] font-bold uppercase tracking-wide text-white">
            Cliente
          </div>
          <div className="bg-table-header px-1 py-1 text-center text-[5px] font-bold uppercase tracking-wide text-white">
            Pago
          </div>
          <div className="bg-table-header px-1 py-1 text-center text-[5px] font-bold uppercase tracking-wide text-white">
            Total
          </div>

          <AnimatePresence initial={false}>
            {showNueva && (
              <motion.div
                key="nueva"
                className="contents"
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                <motion.div
                  variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
                  className="border-t border-accent/30 bg-accent-soft px-1 py-1 text-center text-[5.5px] text-neutral-700"
                >
                  {NUEVA_VENTA.id}
                </motion.div>
                <motion.div
                  variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
                  className="truncate border-t border-accent/30 bg-accent-soft px-1 py-1 text-[5.5px] text-neutral-900"
                >
                  {NUEVA_VENTA.cliente}
                </motion.div>
                <motion.div
                  variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
                  className="border-t border-accent/30 bg-accent-soft px-1 py-1 text-center"
                >
                  <span className="inline-flex items-center gap-0.5 rounded bg-white px-1 py-[1px] text-[5px] font-medium text-neutral-700">
                    <span className={`h-1 w-1 rounded-full ${NUEVA_VENTA.dot}`} />
                    {NUEVA_VENTA.medio}
                  </span>
                </motion.div>
                <motion.div
                  variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
                  className="border-t border-accent/30 bg-accent-soft px-1 py-1 text-center text-[5.5px] font-semibold text-neutral-900"
                >
                  {NUEVA_VENTA.total}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {VENTAS_BASE.map((v, i) => (
            <div key={v.id} className="contents">
              <div
                className={`border-t border-neutral-100 px-1 py-1 text-center text-[5.5px] text-neutral-500 ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
              >
                {v.id}
              </div>
              <div
                className={`truncate border-t border-neutral-100 px-1 py-1 text-[5.5px] text-neutral-700 ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
              >
                {v.cliente}
              </div>
              <div
                className={`border-t border-neutral-100 px-1 py-1 text-center ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
              >
                <span className="inline-flex items-center gap-0.5 rounded bg-neutral-100 px-1 py-[1px] text-[5px] font-medium text-neutral-700">
                  <span className={`h-1 w-1 rounded-full ${v.dot}`} />
                  {v.medio}
                </span>
              </div>
              <div
                className={`border-t border-neutral-100 px-1 py-1 text-center text-[5.5px] font-semibold text-neutral-900 ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
              >
                {v.total}
              </div>
            </div>
          ))}
        </div>
      </div>

      {portalRoot &&
        createPortal(
          <AnimatePresence>{showPalette && <MiniPalette />}</AnimatePresence>,
          portalRoot,
        )}
    </div>
  );
}
