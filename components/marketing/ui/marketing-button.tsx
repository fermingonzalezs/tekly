import type { AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * CTA de la landing con la misma identidad visual que `Button`
 * (components/ui/button.tsx): gradiente índigo/violeta, mayúscula,
 * font-bold, tracking-wider. Es un `<a>` (no `<button>`) porque los CTAs de
 * marketing apuntan a `signupUrl()`/`loginUrl()`, potencialmente otro origen.
 */

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: "primary" | "outline" | "white";
  size?: "sm" | "md" | "lg";
};

export function MarketingButton({
  className,
  variant = "primary",
  size = "md",
  ...props
}: Props) {
  return (
    <a
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold uppercase tracking-wider transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1",
        size === "sm" && "h-9 px-4 text-[11px]",
        size === "md" && "h-11 px-6 text-xs",
        size === "lg" && "h-14 px-8 text-sm",
        variant === "primary" && [
          "text-white bg-[linear-gradient(180deg,var(--chart-3),var(--chart-2))] shadow-xl shadow-accent/25",
          "hover:brightness-95 active:brightness-90",
        ],
        variant === "outline" &&
          "border border-neutral-200 bg-white text-neutral-700 shadow-sm hover:border-neutral-300 hover:bg-neutral-50",
        variant === "white" &&
          "bg-white text-accent shadow-2xl shadow-neutral-900/20 hover:bg-neutral-100",
        className,
      )}
      {...props}
    />
  );
}
