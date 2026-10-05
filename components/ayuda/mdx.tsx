import type { ReactNode } from "react";

/** Componentes MDX propios del centro de ayuda. Se registran en
 * `mdx-components.tsx` (no hace falta importarlos en los `.mdx`). Todos usan
 * el sistema de diseño (Sora por defecto, sin gradientes nuevos). */

/** Paso numerado dentro de una guía. */
export function Paso({
  n,
  titulo,
  children,
}: {
  n: number | string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className="not-prose my-4 flex gap-3.5 rounded-2xl border border-neutral-200 bg-white p-4">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-white">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-900">{titulo}</p>
        <div className="mt-1 text-sm leading-relaxed text-neutral-600 [&_ul]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-0.5">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Aviso destacado. `tono="warning"` para advertencias (recuadro rojo suave),
 * `info` (default) neutro con acento. */
export function Aviso({
  titulo,
  tono = "info",
  children,
}: {
  titulo?: string;
  tono?: "info" | "warning";
  children: ReactNode;
}) {
  const warning = tono === "warning";
  return (
    <div
      className={
        warning
          ? "not-prose my-4 rounded-2xl border border-red-200 bg-red-50/70 p-4"
          : "not-prose my-4 rounded-2xl border border-accent/30 bg-accent-soft/50 p-4"
      }
    >
      {titulo && (
        <p
          className={
            warning
              ? "text-sm font-semibold text-red-700"
              : "text-sm font-semibold text-accent"
          }
        >
          {titulo}
        </p>
      )}
      <div
        className={
          warning
            ? "text-sm leading-relaxed text-neutral-700 [&_ul]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5"
            : "text-sm leading-relaxed text-neutral-700 [&_ul]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5"
        }
      >
        {children}
      </div>
    </div>
  );
}

/** Captura de pantalla (datos demo). Hasta que exista la imagen, muestra el
 * placeholder con el `alt` visible. */
export function Captura({
  alt,
  src,
  caption,
}: {
  alt: string;
  src?: string;
  caption?: string;
}) {
  return (
    <figure className="not-prose my-5">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="w-full rounded-2xl border border-neutral-200 shadow-sm"
          loading="lazy"
        />
      ) : (
        <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
          <span className="text-xs text-neutral-500">
            Captura pendiente · {alt}
          </span>
        </div>
      )}
      {caption && (
        <figcaption className="mt-2 text-center text-xs text-neutral-500">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/** Video corto (≤ 90 s) sobre datos demo. `src` local o YouTube no-cookie. */
export function Video({
  src,
  titulo,
  poster,
}: {
  src: string;
  titulo: string;
  poster?: string;
}) {
  return (
    <figure className="not-prose my-5">
      <video
        controls
        preload="metadata"
        poster={poster}
        className="w-full rounded-2xl border border-neutral-200 shadow-sm"
      >
        <source src={src} />
        Tu navegador no soporta el video.
      </video>
      <figcaption className="mt-2 text-center text-xs text-neutral-500">
        {titulo}
      </figcaption>
    </figure>
  );
}
