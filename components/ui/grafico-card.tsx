import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";

/** Contenedor estándar de un gráfico de sección (plan 009): `Card` con
 *  altura fija `h-72` desde `sm`, encabezado `ChartTitle align="left"
 *  divider` y cuerpo que ocupa el resto. **Todo gráfico de las secciones con
 *  tabla va adentro** -- ninguno define su propia altura. */
export function GraficoCard({
  title,
  sub,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** Control opcional a la derecha del título (ej. selector de período). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "flex h-auto min-w-0 flex-col overflow-hidden p-5 sm:h-72",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <ChartTitle align="left" divider sub={sub}>
            {title}
          </ChartTitle>
        </div>
        {action}
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        {children}
      </div>
    </Card>
  );
}
