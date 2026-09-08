/** Título de gráfico: siempre en mayúscula. Centrado por defecto. */
export function ChartTitle({
  children,
  sub,
  align = "center",
}: {
  children: React.ReactNode;
  sub?: React.ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "left" ? "text-left" : "text-center"}>
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
        {children}
      </p>
      {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}
