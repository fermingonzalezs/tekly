import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/marketing/seo";
import { indicePorSeccion, listArticulos } from "@/lib/ayuda";
import { LEGAL_BORRADOR } from "@/lib/legal";

/** Sitemap de la landing + el centro de ayuda. La app de gestión y los
 * textos legales (mientras sean borrador) no se listan. */
export default function sitemap(): MetadataRoute.Sitemap {
  const ayuda = listArticulos().map((a) => ({
    url: `${SITE_URL}${a.url}`,
    changeFrequency: "monthly" as const,
    priority: 0.6,
    lastModified: a.actualizado,
  }));

  const secciones = indicePorSeccion().map((g) => ({
    url: `${SITE_URL}/ayuda/${g.seccion}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
  const legales = LEGAL_BORRADOR
    ? [] // borrador: noindex, fuera del sitemap hasta publicarlos (plan 012)
    : ["/terminos", "/privacidad", "/cookies"].map((ruta) => ({
        url: `${SITE_URL}${ruta}`,
        changeFrequency: "yearly" as const,
        priority: 0.3,
      }));

  return [
    {
      url: SITE_URL,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/ayuda`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...secciones,
    ...ayuda,
    ...legales,
  ];
}
