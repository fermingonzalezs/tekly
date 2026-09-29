"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useReducedMotion as useFramerReducedMotion } from "framer-motion";

/**
 * useReducedMotion() de framer-motion, pero estable para hidratación: el
 * nativo lee matchMedia en el primer render del cliente (true con
 * prefers-reduced-motion) mientras el SSR siempre renderizó sin reduce -- el
 * árbol del primer paint del cliente no matchea el del server y React tira
 * "Text content does not match server-rendered HTML". Este wrapper devuelve
 * false hasta después de montar (mismo árbol que el SSR, hidratación limpia)
 * y recién ahí aplica el reduce, antes del primer paint (layout effect en el
 * cliente) para que un usuario con reduce no vea un flash del estado inicial
 * oculto de las animaciones.
 */

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function useReducedMotionSafe(): boolean {
  const reduced = useFramerReducedMotion();
  const [mounted, setMounted] = useState(false);
  useIsomorphicLayoutEffect(() => setMounted(true), []);
  return mounted && reduced === true;
}
