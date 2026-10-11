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
  /** Marca + nombre, texto oscuro. Fondos claros (header/footer de la landing, drawer). */
  horizontal: { src: "tekly-isologo.svg", w: 368, h: 108 },
  /** Marca + nombre en blanco y menta, fondo transparente. Fondos índigo u oscuros. */
  "horizontal-blanco": { src: "tekly-isologo-blanco.svg", w: 368, h: 108 },
  /** Con el fondo índigo incluido. */
  "horizontal-sobre-indigo": { src: "tekly-isologo-sobre-indigo.svg", w: 488, h: 228 },
  /** Ícono con la T sobre cuadrado índigo. Avatar, marca chica. */
  icono: { src: "tekly-icono-indigo.svg", w: 200, h: 200 },
  /** Ícono con la T índigo sobre cuadrado blanco. Encabezados índigo / header del sistema. */
  "icono-invertido": { src: "tekly-icono.svg", w: 200, h: 200 },
  /** Solo la T con el punto verde, sin cuadrado. */
  marca: { src: "tekly-marca.svg", w: 120, h: 130 },
  /** Solo el nombre. */
  wordmark: { src: "tekly-wordmark.svg", w: 272, h: 108 },
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
