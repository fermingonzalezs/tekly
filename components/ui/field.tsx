import { cn } from "@/lib/utils";

const base =
  "h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none transition-colors focus:border-accent disabled:bg-neutral-50 disabled:text-neutral-400";

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
        "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-400",
        className,
      )}
    >
      {children}
    </label>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, className)} {...props} />;
}

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
