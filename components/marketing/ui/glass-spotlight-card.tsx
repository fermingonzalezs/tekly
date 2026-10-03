"use client";

import { useRef, type ReactNode } from "react";
import { useReducedMotionSafe } from "./use-reduced-motion";

/**
 * Tarjeta "liquid glass": blur + borde claro + un brillo violeta que sigue
 * al mouse, contenido DENTRO de la tarjeta (nunca tiñe el fondo de la
 * sección). El brillo se mueve escribiendo directo sobre el DOM (ref, sin
 * `useState`) para no re-renderizar en cada mousemove -- mismo criterio de
 * performance que pide la guía de motion para efectos continuos. Con
 * `prefers-reduced-motion` el listener ni se engancha; el brillo queda
 * fijo en su posición inicial.
 */
export function GlassSpotlightCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionSafe();

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced || !cardRef.current || !glowRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    glowRef.current.style.background = `radial-gradient(280px circle at ${x}% ${y}%, rgba(148,141,222,0.3), transparent 65%)`;
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`relative overflow-hidden rounded-3xl border border-white/70 bg-white/55 shadow-[0_24px_48px_-24px_rgba(79,73,189,0.25),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl ${className ?? ""}`}
    >
      <div
        ref={glowRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(280px circle at 20% 10%, rgba(148,141,222,0.3), transparent 65%)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
