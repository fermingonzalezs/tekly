import type { AnchorHTMLAttributes } from "react";
import { ArrowRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** CTA de la landing. Ahora es un envoltorio del sistema de botones
 * (`components/ui/button.tsx`, plan 010): un solo código de estilos para la
 * landing y la app. Se renderiza como `<a>` (no `<button>`) porque los CTAs
 * apuntan a `signupUrl()`/`loginUrl()`, potencialmente otro origen.
 *
 * Variantes: `primary` (accent + chip de flecha), `outline` ("Ingresar", sin
 * chip) e `inverse` (blanco, para apoyarse sobre el fondo accent del cierre).
 * Tamaños `sm` (=`lg` del sistema, 40px) y `md` (=`xl`, 48px). */
type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: "primary" | "outline" | "inverse";
  size?: "sm" | "md";
};

export function MarketingButton({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: Props) {
  const systemSize = size === "sm" ? "lg" : "xl";
  const conChip = variant !== "outline";
  return (
    <a className={buttonClasses({ variant, size: systemSize, chip: conChip, className })} {...props}>
      {children}
      {conChip && (
        <span
          className={cn(
            "flex items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-1",
            size === "sm" ? "h-7 w-7" : "h-8 w-8",
            variant === "inverse" ? "bg-accent-soft" : "bg-white/20",
          )}
        >
          <ArrowRight className="h-4 w-4" />
        </span>
      )}
    </a>
  );
}
