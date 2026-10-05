/**
 * SEO de la landing: único lugar que conoce el origen público de marketing y
 * arma el JSON-LD. La app de gestión (sistema.tekly.tech) no se indexa.
 */

export const SITE_URL = "https://tekly.tech";

export const NOMBRE = "Tekly";

export const DESCRIPCION_LARGA =
  "Tekly es un sistema de gestión en la nube para locales de venta y reparación de celulares: stock por IMEI, ventas con pago dividido, reparaciones con checklist, turnos, cajas con conciliación y analíticas, con acceso por rol para todo el equipo.";

/** Datos estructurados (schema.org) de la home. Sin `offers`: los precios de
 * la landing son provisorios (ver components/marketing/pricing.tsx) y no
 * deben publicarse a Google como oferta real hasta definir el pricing. */
export function jsonLdLanding() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: NOMBRE,
        url: SITE_URL,
        logo: `${SITE_URL}/tekly-logo-kit/png/tekly-icono-512.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: NOMBRE,
        inLanguage: "es-AR",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#software`,
        name: NOMBRE,
        url: SITE_URL,
        description: DESCRIPCION_LARGA,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "es-AR",
        publisher: { "@id": `${SITE_URL}/#organization` },
        featureList: [
          "Inventario con stock por IMEI",
          "Ventas con pago dividido y cuenta corriente",
          "Reparaciones con checklist de ingreso y egreso",
          "Turnos",
          "Cajas con conciliación",
          "Analíticas de ventas, márgenes y clientes",
        ],
      },
    ],
  };
}
