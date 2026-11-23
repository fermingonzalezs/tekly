import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const base =
  "h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition-colors focus:border-accent disabled:bg-neutral-50 disabled:text-neutral-400";

export function Label({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500",
        className,
      )}
    >
      {children}
    </label>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(base, className)} {...props} />;
});

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(base, "pr-8", className)} {...props} />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(base, "h-auto py-2 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
  className,
  labelClassName,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <div className={className}>
      <Label className={labelClassName}>{label}</Label>
      {children}
    </div>
  );
}

/** Grilla estándar de un formulario: 3 casillas por fila desde `sm`, 1 en
 * mobile. Un campo largo (nombre, dirección, textarea, buscador) ocupa la fila
 * entera con `className="sm:col-span-3"`; un par que necesita más aire usa
 * `sm:col-span-2`. Ver `Dialog` prop `formulario`. */
export function GrillaCampos({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-3.5 sm:grid-cols-3", className)}>
      {children}
    </div>
  );
}
