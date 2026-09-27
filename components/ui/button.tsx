import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md";
  shape?: "rounded" | "pill";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  shape = "rounded",
  ...props
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-bold uppercase tracking-wider transition-all duration-150",
        shape === "pill" ? "rounded-full" : "rounded-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1",
        "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
        size === "sm" ? "h-8 px-3.5 text-[11px]" : "h-9 px-4 text-xs",
        variant === "primary" && [
          "text-white bg-[linear-gradient(180deg,var(--chart-3),var(--chart-2))]",
          // Oscurecer por brillo (no hex por paleta) -- sigue funcionando
          // con cualquier tema activo.
          "hover:brightness-95 active:brightness-90",
        ],
        variant === "outline" &&
          "border border-neutral-200 bg-white text-neutral-600 shadow-sm hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900",
        variant === "ghost" &&
          "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
        className,
      )}
      {...props}
    />
  );
}
