/**
 * Tarjeta "liquid glass" de la landing: blanco translúcido + blur con
 * saturación, borde blanco casi opaco y una sombra en capas (brillo interno
 * arriba + anillo índigo muy tenue + sombra larga). El blur solo se nota si
 * hay algo sólido detrás -- por eso las secciones que lo usan ponen una forma
 * (`GLASS_SHAPE_*`) atrás.
 */
export const GLASS =
  "border border-white/95 bg-white/60 backdrop-blur-[18px] backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_0_0_1px_rgb(var(--accent-rgb)/0.06),0_20px_50px_-30px_rgba(30,27,75,.25)]";

/** Variante más pesada para los paneles grandes (hero, analíticas). */
export const GLASS_STRONG =
  "border border-white/95 bg-white/60 backdrop-blur-[24px] backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_0_0_1px_rgb(var(--accent-rgb)/0.07),0_40px_80px_-36px_rgba(30,27,75,.32)]";

/** Sub-tarjeta blanca sólida que va adentro de una de vidrio. */
export const GLASS_INNER = "rounded-2xl border border-neutral-900/[.06] bg-white";
