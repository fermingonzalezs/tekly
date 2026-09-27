import { cn } from "@/lib/utils";

export type TreemapItem = { label: string; value: number; color: string };

type Rect = TreemapItem & {
  /** Fracciones 0..1 respecto al contenedor. */
  x: number;
  y: number;
  w: number;
  h: number;
  pct: number;
};

const GAP = 3; // px entre rectángulos

/** Divide la lista (ordenada desc) en dos mitades de valor lo más
 * balanceado posible, conservando el orden. */
function partir(items: TreemapItem[]): [TreemapItem[], TreemapItem[]] {
  const total = items.reduce((a, i) => a + i.value, 0);
  let acc = 0;
  let i = 0;
  while (i < items.length - 1 && (acc + items[i].value) * 2 <= total) {
    acc += items[i].value;
    i++;
  }
  const corte = Math.max(1, i);
  return [items.slice(0, corte), items.slice(corte)];
}

/** Split binario recursivo: cada mitad se queda con la franja proporcional
 * a su valor, sobre el eje largo del contenedor. Con pocas categorías da
 * rectángulos de proporciones casi cuadradas, como el squarify. */
function layout(
  items: TreemapItem[],
  x: number,
  y: number,
  w: number,
  h: number,
  total: number,
  out: Rect[],
) {
  if (items.length === 0) return;
  if (items.length === 1) {
    out.push({
      ...items[0],
      x,
      y,
      w,
      h,
      pct: Math.round((items[0].value / total) * 100),
    });
    return;
  }
  const [a, b] = partir(items);
  const totalA = a.reduce((s, i) => s + i.value, 0);
  const totalAB = a.concat(b).reduce((s, i) => s + i.value, 0);
  const f = totalA / totalAB;
  if (w >= h) {
    layout(a, x, y, w * f, h, total, out);
    layout(b, x + w * f, y, w * (1 - f), h, total, out);
  } else {
    layout(a, x, y, w, h * f, total, out);
    layout(b, x, y + h * f, w, h * (1 - f), total, out);
  }
}

/** Treemap: cada categoría es un rectángulo whose área ∝ su valor. Para
 * parte-de-un-todo con etiquetas más largas de lo que entra en una dona.
 * Valores en 0 no ocupan lugar; sin datos muestra un empty state. El % y
 * el monto van dentro del rectángulo (o solo el % si es chico); el detalle
 * completo, en el `title` (hover). */
export function Treemap({
  data,
  fmt,
  className,
}: {
  data: TreemapItem[];
  /** Formatea el valor (ej. `fmtUsd`) para el detalle dentro/hover. */
  fmt?: (n: number) => string;
  className?: string;
}) {
  const items = data
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = items.reduce((a, i) => a + i.value, 0);

  if (total <= 0) {
    return (
      <div
        className={cn(
          "grid h-56 w-full place-items-center text-sm text-neutral-400",
          className,
        )}
      >
        Sin datos en el período filtrado
      </div>
    );
  }

  const rects: Rect[] = [];
  layout(items, 0, 0, 1, 1, total, rects);

  return (
    <div className={cn("relative h-56 w-full", className)}>
      {rects.map((r, i) => {
        // Rectángulo angosto/bajo: el label no entra, va solo el %.
        const compacto = r.w < 0.16 || r.h < 0.24;
        return (
          <div
            key={i}
            title={`${r.label} · ${r.pct}%${fmt ? ` · ${fmt(r.value)}` : ""}`}
            className="absolute flex flex-col items-center justify-center overflow-hidden rounded-lg px-2 text-center text-white"
            style={{
              left: `calc(${r.x * 100}% + ${GAP}px)`,
              top: `calc(${r.y * 100}% + ${GAP}px)`,
              width: `calc(${r.w * 100}% - ${GAP * 2}px)`,
              height: `calc(${r.h * 100}% - ${GAP * 2}px)`,
              background: r.color,
            }}
          >
            {compacto ? (
              <span className="text-xs font-semibold tabular-nums">{r.pct}%</span>
            ) : (
              <>
                <span className="text-[11px] font-semibold uppercase tracking-wide opacity-90">
                  {r.label}
                </span>
                <span className="font-grotesk text-lg font-semibold tabular-nums">
                  {r.pct}%
                </span>
                {fmt && r.w > 0.3 && (
                  <span className="text-xs tabular-nums opacity-80">
                    {fmt(r.value)}
                  </span>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
