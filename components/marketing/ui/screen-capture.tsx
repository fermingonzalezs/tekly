"use client";

import { useReducedMotionSafe } from "./use-reduced-motion";

/**
 * Captura de pantalla real (video) de una sección del sistema -- reemplaza
 * a los mockups ilustrados módulo por módulo (arrancando por Turnos,
 * `public/turnos.mp4`). Mismo marco visual que los mockups que reemplaza
 * (`rounded-2xl border shadow-2xl shadow-accent/10`), loop silencioso sin
 * controles. Con `prefers-reduced-motion` no autoplayea ni hace loop --
 * queda quieto en el primer frame, mismo criterio que el resto de las
 * animaciones de la landing.
 */
export function ScreenCapture({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const reduced = useReducedMotionSafe();

  return (
    <video
      aria-hidden="true"
      className={`block w-full rounded-2xl border border-neutral-200 bg-white object-cover shadow-2xl shadow-accent/10 ${className ?? ""}`}
      autoPlay={!reduced}
      loop={!reduced}
      muted
      playsInline
      preload="metadata"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
