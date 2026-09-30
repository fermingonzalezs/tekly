import type { AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * CTA de la landing con la MISMA identidad visual que `Button`
 * (components/ui/button.tsx) -- mismas alturas/paddings/tamaños de texto,
 * no una escala propia. Es un `<a>` (no `<button>`) porque los CTAs de
 * marketing apuntan a `signupUrl()`/`loginUrl()`, potencialmente otro
 * origen. `shape` default "pill" porque el contexto pre-login (como
 * `/login`/`/signup`, que también usan `<Button shape="pill">`) es al que
 * pertenece la landing. `variant="white"` es la única adición real: no
 * existe en `Button` porque ningún botón de la app se apoya sobre un fondo
 * en gradiente -- necesario para el CTA final, misma escala que el resto.
 */

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: "primary" | "outline" | "white";
  size?: "sm" | "md";
  shape?: "rounded" | "pill";
};

export function MarketingButton({
  className,
  variant = "primary",
  size = "md",
  shape = "pill",
  ...props
}: Props) {
  return (
    <a
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-bold uppercase tracking-wider transition-all duration-150",
        shape === "pill" ? "rounded-full" : "rounded-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1",
        size === "sm" ? "h-10 px-4 text-[11px]" : "h-11 px-5 text-xs",
        variant === "primary" && [
          "text-white bg-[linear-gradient(180deg,var(--chart-3),var(--chart-2))]",
          "hover:brightness-95 active:brightness-90",
        ],
        variant === "outline" &&
          "border border-neutral-200 bg-white text-neutral-600 shadow-sm hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900",
        variant === "white" &&
          "bg-white text-accent shadow-sm hover:bg-neutral-100",
        className,
      )}
      {...props}
    />
  );
}
