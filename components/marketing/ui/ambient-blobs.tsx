"use client";

import { motion } from "framer-motion";
import { useReducedMotionSafe } from "./use-reduced-motion";

/**
 * Fondo compartido de la landing: manchas difuminadas a la deriva
 * (movimiento ambiente lento, sin relación con el scroll). Antes cada
 * sección lo reimplementaba a mano (hero, CTA final) -- ahora es un solo
 * componente para poder sumarlo a más secciones sin duplicar la lógica de
 * `prefers-reduced-motion`. `dx`/`dy` en px, `duration` en segundos.
 */

export type Blob = {
  className: string;
  dx: number;
  dy: number;
  duration: number;
};

export function AmbientBlobs({ blobs }: { blobs: Blob[] }) {
  const reduced = useReducedMotionSafe();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {blobs.map((blob, i) => (
        <motion.div
          key={i}
          className={blob.className}
          animate={
            reduced ? undefined : { x: [0, blob.dx, 0], y: [0, blob.dy, 0] }
          }
          transition={{
            duration: blob.duration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
