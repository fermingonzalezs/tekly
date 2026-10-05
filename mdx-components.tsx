import type { MDXComponents } from "mdx/types";
import { Paso, Aviso, Captura, Video } from "@/components/ayuda/mdx";
import { slugify } from "@/lib/ayuda";

/** Componentes MDX del centro de ayuda. Los `.mdx` de `content/ayuda/**` ven
 * estos por nombre (sin import): `<Paso>`, `<Aviso>`, `<Captura>`, `<Video>`.
 * Los headings (`h2`/`h3`) llevan un `id` para el índice lateral / anclas. */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    Paso,
    Aviso,
    Captura,
    Video,
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 id={slugify(textoDe(children))} className="scroll-mt-24">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 id={slugify(textoDe(children))} className="scroll-mt-24">{children}</h3>
    ),
    ...components,
  };
}

function textoDe(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(textoDe).join("");
  if (children && typeof children === "object" && "props" in children) {
    return textoDe((children as { props?: { children?: React.ReactNode } }).props?.children);
  }
  return String(children ?? "");
}

