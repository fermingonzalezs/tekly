import { cn } from "@/lib/utils";

/** Tooltip de hover de los gráficos (patrón global de CLAUDE.md): caja
 * `bg-neutral-900` texto blanco, `rounded-lg`, `shadow-lg`,
 * `pointer-events-none`; título centrado, cada fila label a la izquierda y
 * valor a la derecha (`ml-auto`). Quien lo usa lo posiciona. */
export function TooltipBox({
  title,
  rows,
  className,
  style,
}: {
  title: string;
  rows: [string, string][];
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        "pointer-events-none absolute z-30 w-max max-w-[260px] rounded-lg bg-neutral-900 px-3 py-2 text-left text-xs text-white shadow-lg",
        className,
      )}
    >
      <p className="text-center font-semibold">{title}</p>
      <div className="mt-1 space-y-0.5">
        {rows.map(([label, value]) => (
          <p key={label} className="flex items-center gap-4 whitespace-nowrap">
            <span className="text-white/60">{label}</span>
            <span className="ml-auto font-semibold tabular-nums">{value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
