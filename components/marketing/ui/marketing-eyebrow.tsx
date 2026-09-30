import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Subtítulo pill de cada sección -- mismo tratamiento que el badge del hero
 * ("Para tiendas de venta y reparación de iPhones"), para que las secciones
 * se lean como el mismo sistema. `tone="light"` es para usar sobre el fondo
 * en gradiente del CTA final (texto/borde blancos en vez de accent).
 */

export function MarketingEyebrow({
  children,
  tone = "accent",
  className,
}: {
  children: ReactNode;
  tone?: "accent" | "light";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider",
        tone === "accent" && "border-accent/25 bg-accent-soft text-accent",
        tone === "light" && "border-white/30 bg-white/10 text-white",
        className,
      )}
    >
      {children}
    </span>
  );
}
