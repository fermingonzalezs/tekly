import type { AnchorHTMLAttributes } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * CTA de la landing, dirección "chip de flecha": pill sólido del accent con
 * la flecha dentro de un círculo que se desliza al hover, tipografía normal
 * (sin mayúsculas). Es un `<a>` (no `<button>`) porque los CTAs de marketing
 * apuntan a `signupUrl()`/`loginUrl()`, potencialmente otro origen.
 * `outline` ("Ingresar") es la variante sin chip; `white` existe para
 * apoyarse sobre el gradiente del cierre (nadie en la app lo necesita). El
 * chip de la flecha lo renderiza el componente: los callers pasan solo el
 * label.
 */

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: "primary" | "outline" | "white";
  size?: "sm" | "md";
};

export function MarketingButton({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: Props) {
  const conChip = variant !== "outline";
  return (
    <a
      className={cn(
        "group inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1",
        conChip
          ? size === "sm"
            ? "h-10 gap-2.5 pl-5 pr-1.5 text-[13px]"
            : "h-12 gap-3 pl-6 pr-2 text-sm"
          : size === "sm"
            ? "h-10 px-4 text-[13px]"
            : "h-12 px-6 text-sm",
        variant === "primary" &&
          "bg-accent text-white shadow-lg shadow-accent/25 hover:brightness-95",
        variant === "outline" &&
          "border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:text-neutral-900",
        variant === "white" &&
          "bg-white text-accent shadow-xl hover:bg-neutral-100",
        className,
      )}
      {...props}
    >
      {children}
      {conChip && (
        <span
          className={cn(
            "flex items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-1",
            size === "sm" ? "h-7 w-7" : "h-8 w-8",
            variant === "white" ? "bg-accent-soft" : "bg-white/20",
          )}
        >
          <ArrowRight className="h-4 w-4" />
        </span>
      )}
    </a>
  );
}
