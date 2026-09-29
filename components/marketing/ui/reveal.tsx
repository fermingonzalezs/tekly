"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { useReducedMotionSafe } from "./use-reduced-motion";

/**
 * Wrapper genérico de scroll-reveal para la landing: fade + slide-up al
 * entrar en viewport, una sola vez. Con `prefers-reduced-motion` activo no
 * anima (sale en su lugar directamente).
 */

const variants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotionSafe();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Contenedor para grillas con stagger: los hijos revelan en cascada al
 * entrar en viewport. Cada hijo usa <RevealItem> (no <Reveal>, que lleva
 * `whileInView` propio y rompería la orquestación del padre).
 */

export function RevealStagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotionSafe();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.08 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotionSafe();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: "easeOut" },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
