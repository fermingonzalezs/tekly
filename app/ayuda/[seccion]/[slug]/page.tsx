import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { compileMDX } from "next-mdx-remote/rsc";
import { SECTION_WRAP } from "@/components/marketing/ui/section-heading";
import { useMDXComponents } from "@/mdx-components";
import { SITE_URL } from "@/lib/marketing/seo";
import {
  SECCION_LABEL,
  getArticulo,
  headings,
  indicePlano,
  listArticulos,
  relacionados,
  vecinos,
} from "@/lib/ayuda";

const COMPONENTES = useMDXComponents({});

export function generateStaticParams() {
  return listArticulos().map((a) => ({ seccion: a.seccion, slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { seccion: string; slug: string };
}) {
  const art = getArticulo(params.seccion, params.slug);
  if (!art) return { title: "Artículo no encontrado" };
  const title = art.titulo.length > 60 ? art.titulo.slice(0, 57) + "…" : art.titulo;
  const description =
    art.resumen.length > 155 ? art.resumen.slice(0, 152) + "…" : art.resumen;
  return {
    title,
    description,
    alternates: { canonical: art.url },
    openGraph: { title, description, url: `${SITE_URL}${art.url}`, type: "article" },
  };
}

function JsonLd({ art, headings: hs }: { art: ReturnType<typeof getArticulo>; headings: ReturnType<typeof headings> }) {
  if (!art) return null;
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: art.titulo,
    description: art.resumen,
    dateModified: art.actualizado,
    inLanguage: "es-AR",
    url: `${SITE_URL}${art.url}`,
    author: { "@type": "Organization", name: "Tekly", url: SITE_URL },
    publisher: { "@type": "Organization", name: "Tekly", url: SITE_URL },
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ayuda", item: `${SITE_URL}/ayuda` },
      {
        "@type": "ListItem",
        position: 2,
        name: SECCION_LABEL[art.seccion],
        item: `${SITE_URL}/ayuda/${art.seccion}`,
      },
      { "@type": "ListItem", position: 3, name: art.titulo, item: `${SITE_URL}${art.url}` },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify([article, breadcrumb]) }}
    />
  );
}

export default async function ArticuloPage({
  params,
}: {
  params: { seccion: string; slug: string };
}) {
  const art = getArticulo(params.seccion, params.slug);
  if (!art) notFound();

  const hs = headings(art.cuerpo);
  const { content } = await compileMDX({
    source: art.cuerpo,
    components: COMPONENTES,
    options: { parseFrontmatter: false },
  });
  const { anterior, siguiente } = vecinos(art);
  const rel = relacionados(art);
  const indice = indicePlano();

  return (
    <main className={`${SECTION_WRAP} pb-24 pt-10`}>
      <JsonLd art={art} headings={hs} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
        <article className="min-w-0">
          <nav className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Link href="/ayuda" className="transition-colors hover:text-accent">
              Ayuda
            </Link>
            <span>/</span>
            <Link href={`/ayuda/${art.seccion}`} className="transition-colors hover:text-accent">
              {SECCION_LABEL[art.seccion]}
            </Link>
          </nav>

          <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-extrabold uppercase leading-[.98] tracking-[-0.02em]">
            {art.titulo}
          </h1>
          <p className="mt-3 max-w-[65ch] text-base leading-relaxed text-neutral-600">
            {art.resumen}
          </p>

          <div className="prose-ayuda mt-8 max-w-[65ch] space-y-4 text-[15px] leading-relaxed text-neutral-700 [&_a]:font-medium [&_a]:text-accent [&_a:hover]:underline [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-neutral-900 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-neutral-900 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
            {content}
          </div>

          {/* ¿Te sirvió? */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-sm text-neutral-600">
              ¿Te sirvió este artículo? Si algo no cierra, escribinos.
            </p>
            <a
              href="mailto:soporte@tekly.tech?subject=Consulta%20sobre%20la%20ayuda"
              className="text-sm font-semibold text-accent hover:underline"
            >
              soporte@tekly.tech
            </a>
          </div>

          {/* anterior / siguiente */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {anterior ? (
              <Link
                href={anterior.url}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-accent"
              >
                <ArrowLeft className="h-4 w-4" /> {anterior.titulo}
              </Link>
            ) : (
              <span />
            )}
            {siguiente && (
              <Link
                href={siguiente.url}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-accent"
              >
                {siguiente.titulo} <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            {hs.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  En esta página
                </p>
                <ul className="mt-2 space-y-1.5">
                  {hs.map((h) => (
                    <li key={h.id} className={h.nivel === 3 ? "pl-3" : ""}>
                      <a
                        href={`#${h.id}`}
                        className="text-xs text-neutral-600 transition-colors hover:text-accent"
                      >
                        {h.texto}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {rel.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Relacionados
                </p>
                <ul className="mt-2 space-y-1.5">
                  {rel.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={r.url}
                        className="text-xs text-neutral-600 transition-colors hover:text-accent"
                      >
                        {r.titulo}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[11px] text-neutral-400">
              Actualizado {art.actualizado} · {indice.length} artículos
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
