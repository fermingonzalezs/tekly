"use client";

import { cn } from "@/lib/utils";

export function Tabs<T extends string>({
  value,
  onChange,
  options,
  accent,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  /** Color del estado activo (hex). Default: el `accent` de Tailwind. */
  accent?: string;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? accent
                  ? ""
                  : "border-accent text-accent"
                : "border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-800",
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
