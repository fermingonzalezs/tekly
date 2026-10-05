"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAGE_SIZE, paginasVisibles } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/** Paginador clásico reutilizable: "Mostrando 1–50 de 312" a la izquierda y
 * los números de página a la derecha. Se oculta con una sola página. */
export function Pagination({
  page,
  total,
  pageSize = PAGE_SIZE,
  onPageChange,
  className,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  if (totalPaginas <= 1) return null;

  const desde = (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, total);
  const paginas = paginasVisibles(page, totalPaginas);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 sm:flex-row",
        className,
      )}
    >
      <p className="text-xs text-neutral-500">
        Mostrando{" "}
        <span className="tabular-nums">
          {desde}–{hasta}
        </span>{" "}
        de <span className="tabular-nums">{total}</span>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Anterior
        </Button>
        {paginas.map((p, i) =>
          p === "…" ? (
            <span
              key={`elipsis-${i}`}
              className="px-1 text-xs text-neutral-500"
              aria-hidden
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              aria-label={`Página ${p}`}
              className={cn(
                "h-8 min-w-8 rounded-full border px-2 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1",
                p === page
                  ? "border-accent text-accent"
                  : "border-neutral-900/10 text-neutral-600 hover:border-neutral-900/20 hover:bg-neutral-50",
              )}
            >
              {p}
            </button>
          ),
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPaginas}
          onClick={() => onPageChange(page + 1)}
          aria-label="Página siguiente"
        >
          Siguiente
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
