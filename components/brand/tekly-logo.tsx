/**
 * Logo de Tekly (kit en `public/tekly-logo-kit/`, ver CLAUDE.md → "Marca").
 * Un solo lugar con las rutas y las proporciones de cada variante, así los
 * usos no hardcodean `/tekly-logo-kit/...` ni tienen que acordarse del
 * tamaño (sin saltos de layout: `width`/`height` siempre van).
 *
 * Es el logo de la PLATAFORMA. El logo de cada negocio (recibos, header del
 * sistema cuando lo cargó) es otra cosa: viene de `organizations`.
 */

const VARIANTES = {
  /** Ícono + nombre, texto oscuro. Fondos claros (header/footer de la landing, drawer). */
  horizontal: { src: "tekly-isologo-horizontal.svg", w: 427, h: 119 },
  /** Ícono + nombre en blanco, fondo transparente. Fondos índigo u oscuros. */
  "horizontal-blanco": { src: "tekly-isologo-horizontal-blanco.svg", w: 427, h: 119 },
  /** Con el fondo índigo incluido. */
  "horizontal-sobre-indigo": { src: "tekly-isologo-horizontal-sobre-indigo.svg", w: 507, h: 199 },
  /** Ícono sobre nombre. Login, splash. */
  vertical: { src: "tekly-isologo-vertical.svg", w: 187, h: 224 },
  /** Solo el ícono (T blanca sobre globo, fondo índigo). Avatar, marca chica. */
  icono: { src: "tekly-icono.svg", w: 200, h: 200 },
  /** Ícono blanco con la T índigo. Sobre fondos índigo u oscuros. */
  "icono-invertido": { src: "tekly-icono-invertido.svg", w: 200, h: 200 },
  /** Solo el nombre. */
  wordmark: { src: "tekly-wordmark.svg", w: 246, h: 109 },
} as const;

export type TeklyLogoVariante = keyof typeof VARIANTES;

export function TeklyLogo({
  variante = "horizontal",
  altura,
  className,
  alt = "Tekly",
}: {
  variante?: TeklyLogoVariante;
  /** Alto en px; el ancho sale de la proporción de la variante. */
  altura: number;
  className?: string;
  /** `""` cuando el logo es decorativo (el link/botón que lo contiene ya tiene `aria-label`). */
  alt?: string;
}) {
  const v = VARIANTES[variante];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estático de /public
    <img
      src={`/tekly-logo-kit/${v.src}`}
      alt={alt}
      width={Math.round((v.w * altura) / v.h)}
      height={altura}
      className={className}
      draggable={false}
    />
  );
}
