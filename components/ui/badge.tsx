import { cn } from "@/lib/utils";
import { toneClass, dotClass, type Tone } from "@/lib/status";

/**
 * Etiqueta. Forma ÚNICA en toda la app: cuadrada (`rounded-md`), `text-xs`,
 * ring de color según `tone`. No hay variante pill — todas iguales.
 */
export function Badge({
  children,
  tone = "gray",
  dot = false,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneClass[tone],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotClass[tone])} />}
      {children}
    </span>
  );
}
