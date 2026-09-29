"use client";

import { motion } from "framer-motion";
import { useReducedMotionSafe } from "./use-reduced-motion";

/**
 * Headline animado de la landing: revela palabra por palabra (fade +
 * translateY corto, stagger ~50ms) al montar, una sola vez. Con
 * `prefers-reduced-motion` sale completo sin animar.
 */

export function AnimatedWords({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotionSafe();
  const words = text.split(" ");

  if (reduced) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className} aria-label={text}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          aria-hidden="true"
          className="inline-block"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            ease: "easeOut",
            delay: delay + i * 0.05,
          }}
        >
          {word}
          {i < words.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </span>
  );
}
