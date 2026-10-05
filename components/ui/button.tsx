import Link from "next/link";
import { ArrowRight, Loader2, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sistema de botones único de la app (plan 010): mismo componente para la
 * landing y para la gestión, solo cambia el tamaño. Pill, semibold, sin
 * mayúsculas. `Button` (acción), `IconButton` (solo ícono, `aria-label`
 * obligatorio) y `ButtonLink` (navegación con apariencia de botón). */

export type ButtonVariant =
  | "primary"
  | "outline"
  | "tonal"
  | "ghost"
  | "danger"
  | "danger-outline"
  | "link"
  | "inverse";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white shadow-lg shadow-accent/25 hover:brightness-95",
  outline:
    "border border-neutral-900/10 bg-white/65 text-neutral-900 hover:bg-white",
  tonal:
    "border border-accent/30 bg-accent-soft/50 text-accent hover:bg-accent-soft",
  ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
  danger: "bg-red-600 text-white shadow-lg shadow-red-600/20 hover:brightness-95",
  "danger-outline": "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  link: "text-accent hover:underline",
  /** Solo la landing (CTA sobre fondo accent). */
  inverse: "bg-white text-accent shadow-xl hover:bg-neutral-100",
};

const CHIP_VARIANT: Partial<Record<ButtonVariant, string>> = {
  primary: "bg-white/20",
  inverse: "bg-accent-soft",
};

/** Alto, padding y tipografía; `conChip` cambia el padding para que el chip
 * quede centrado dentro del pill. */
function dimensiones(size: ButtonSize, conChip: boolean): string {
  if (size === "sm") {
    return conChip ? "h-8 gap-1.5 pl-3.5 pr-1 text-[13px]" : "h-8 px-3.5 text-[13px]";
  }
  if (size === "md") {
    return conChip ? "h-9 gap-2 pl-4 pr-1 text-sm" : "h-9 px-4 text-sm";
  }
  if (size === "lg") {
    // = sm de la landing
    return conChip ? "h-10 gap-2.5 pl-5 pr-1.5 text-[13px]" : "h-10 px-4 text-[13px]";
  }
  // xl = md de la landing (hero / CTA final)
  return conChip ? "h-12 gap-3 pl-6 pr-2 text-sm" : "h-12 px-6 text-sm";
}

function chipSize(size: ButtonSize): string {
  if (size === "sm") return "h-6 w-6";
  if (size === "xl") return "h-8 w-8";
  return "h-7 w-7";
}

const BASE =
  "group inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none";

/** Clases del botón para quien necesita renderizar su propio elemento (ej.
 * el `<a>` de la landing, que apunta a otro origen). */
export function buttonClasses(opts: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  chip?: boolean;
  fullOnMobile?: boolean;
  className?: string;
}): string {
  const { variant = "primary", size = "md", chip = false, fullOnMobile, className } = opts;
  const esLink = variant === "link";
  return cn(
    BASE,
    dimensiones(size, chip),
    esLink && "h-auto rounded-none px-0 shadow-none",
    VARIANT[variant],
    fullOnMobile && "w-full sm:w-auto",
    className,
  );
}

/** Círculo con flecha de los CTA (exportado para el `<a>` de la landing). */
export function ButtonChip({
  size = "md",
  variant = "primary",
}: {
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return <Chip size={size} variant={variant} />;
}

function Chip({ size, variant }: { size: ButtonSize; variant: ButtonVariant }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-1",
        chipSize(size),
        CHIP_VARIANT[variant] ?? "bg-white/20",
      )}
    >
      <ArrowRight className="h-4 w-4" />
    </span>
  );
}

/** Variantes con "pill" propio: el ícono va en un círculo a la derecha (igual
 * que la flecha de los CTA). `ghost` y `link` no tienen caja, así que ahí el
 * ícono queda suelto a la izquierda. */
const ICON_CHIP_VARIANT: Partial<Record<ButtonVariant, string>> = {
  primary: "bg-white/20",
  danger: "bg-white/20",
  inverse: "bg-accent-soft",
  outline: "bg-neutral-900/5",
  tonal: "bg-accent/10",
  "danger-outline": "bg-red-100/70",
};

function tieneCirculoDeIcono(variant: ButtonVariant): boolean {
  return variant in ICON_CHIP_VARIANT;
}

/** Ícono dentro de un círculo, con una animación mínima al hover del botón
 * (`group`): el "+" gira 90°, el resto crece un poco -- el equivalente de la
 * flecha que se desliza en el chip de los CTA. */
function IconChip({
  icon: Icon,
  size,
  variant,
  loading,
}: {
  icon?: LucideIcon;
  size: ButtonSize;
  variant: ButtonVariant;
  loading?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        chipSize(size),
        ICON_CHIP_VARIANT[variant] ?? "bg-white/20",
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        Icon && (
          <Icon
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-200 ease-out",
              Icon === Plus ? "group-hover:rotate-90" : "group-hover:scale-110",
            )}
          />
        )
      )}
    </span>
  );
}

/** Contenido común de `Button` y `ButtonLink`: texto + (círculo con flecha |
 * círculo con ícono | ícono suelto | spinner). Con círculo, el spinner de
 * `loading` va adentro del círculo para que el botón no cambie de ancho. */
function Contenido({
  children,
  icon: Icon,
  chip,
  loading,
  size,
  variant,
}: {
  children?: React.ReactNode;
  icon?: LucideIcon;
  chip: boolean;
  loading: boolean;
  size: ButtonSize;
  variant: ButtonVariant;
}) {
  const circuloIcono = Boolean(Icon) && !chip && tieneCirculoDeIcono(variant);
  if (chip) {
    return (
      <>
        {children}
        {loading ? (
          <IconChip size={size} variant={variant} loading />
        ) : (
          <Chip size={size} variant={variant} />
        )}
      </>
    );
  }
  if (circuloIcono) {
    return (
      <>
        {children}
        <IconChip icon={Icon} size={size} variant={variant} loading={loading} />
      </>
    );
  }
  return (
    <>
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        Icon && <Icon className="h-4 w-4 shrink-0" />
      )}
      {children}
    </>
  );
}

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Muestra el círculo con flecha a la derecha (CTA principal). */
  chip?: boolean;
  /** Ícono a la izquierda (ícono + texto). */
  icon?: LucideIcon;
  loading?: boolean;
  /** `w-full sm:w-auto` -- footers de dialog que se apilan en mobile. */
  fullOnMobile?: boolean;
  /** @deprecated todo es pill; se mantiene solo por compatibilidad. */
  shape?: "rounded" | "pill";
  className?: string;
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & BaseProps;

export function Button({
  className,
  variant = "primary",
  size = "md",
  chip = false,
  icon: Icon,
  loading = false,
  fullOnMobile = false,
  shape: _shape,
  children,
  disabled,
  ...props
}: Props) {
  const conCirculo = chip || (Boolean(Icon) && tieneCirculoDeIcono(variant));
  const esLink = variant === "link";
  return (
    <button
      className={cn(
        BASE,
        dimensiones(size, conCirculo),
        esLink && "h-auto rounded-none px-0 shadow-none",
        VARIANT[variant],
        fullOnMobile && "w-full sm:w-auto",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      <Contenido icon={Icon} chip={chip} loading={loading} size={size} variant={variant}>
        {children}
      </Contenido>
    </button>
  );
}

type IconVariant = "primary" | "ghost" | "outline" | "danger-ghost";
const ICON_VARIANT: Record<IconVariant, string> = {
  /** Sólido accent con ícono blanco (botón flotante del buscador). */
  primary: "bg-accent text-white shadow-lg shadow-accent/30 hover:brightness-95 active:scale-[0.96]",
  ghost: "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
  outline: "border border-neutral-900/10 bg-white/65 text-neutral-700 hover:bg-white",
  "danger-ghost": "text-neutral-500 hover:bg-red-50 hover:text-red-600",
};

type IconButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children"
> & {
  "aria-label": string;
  icon: LucideIcon;
  variant?: IconVariant;
  size?: ButtonSize;
  shape?: "round" | "square";
};

export function IconButton({
  icon: Icon,
  variant = "ghost",
  size = "md",
  shape = "round",
  className,
  ...props
}: IconButtonProps) {
  const dim =
    size === "sm" ? "h-7 w-7" : size === "lg" ? "h-9 w-9" : size === "xl" ? "h-14 w-14" : "h-8 w-8";
  const iconDim = size === "sm" ? "h-3.5 w-3.5" : size === "xl" ? "h-6 w-6" : "h-4 w-4";
  return (
    <button
      type="button"
      className={cn(
        "inline-grid shrink-0 place-items-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
        dim,
        shape === "round" ? "rounded-full" : "rounded-lg",
        ICON_VARIANT[variant],
        className,
      )}
      {...props}
    >
      <Icon className={iconDim} />
    </button>
  );
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & BaseProps;

/** Igual que `Button` pero renderiza `next/link`. Para links externos
 * (`http…`) usar `<a>` a mano con `Button variant="link"` o el
 * `MarketingButton` de la landing. */
export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  chip = false,
  icon: Icon,
  loading = false,
  fullOnMobile = false,
  shape: _shape,
  children,
  ...props
}: ButtonLinkProps) {
  const conCirculo = chip || (Boolean(Icon) && tieneCirculoDeIcono(variant));
  const esLink = variant === "link";
  return (
    <Link
      className={cn(
        BASE,
        dimensiones(size, conCirculo),
        esLink && "h-auto rounded-none px-0 shadow-none",
        VARIANT[variant],
        fullOnMobile && "w-full sm:w-auto",
        className,
      )}
      {...props}
    >
      <Contenido icon={Icon} chip={chip} loading={loading} size={size} variant={variant}>
        {children}
      </Contenido>
    </Link>
  );
}
