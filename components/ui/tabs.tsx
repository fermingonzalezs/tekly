"use client";

import { cn } from "@/lib/utils";

export function Tabs<T extends string>({
  value,
  onChange,
  options,
  accent,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  /** Color del estado activo (hex). Default: el `accent` de Tailwind. */
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              // Misma altura (36px), radio (pill), borde y foco que un
              // `Button` outline (plan 010) para que una fila de filtros se vea
              // pareja; no es un Button, es un toggle de navegación.
              "flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1",
              active
                ? accent
                  ? ""
                  : "border-accent text-accent"
                : "border-neutral-900/10 text-neutral-600 hover:border-neutral-900/20 hover:text-neutral-900",
            )}
            style={
              active && accent
                ? { borderColor: accent, color: accent }
                : undefined
            }
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  active
                    ? "bg-accent/10 text-accent"
                    : "bg-neutral-100 text-neutral-400",
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
