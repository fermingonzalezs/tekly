import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { SITE_URL } from "@/lib/marketing/seo";

const MARKETING_HOSTS = new Set(["tekly.tech", "www.tekly.tech", "tekly.localhost"]);

/** `robots.txt` según el host: tekly.tech (landing) se indexa; la app de
 * gestión (sistema.tekly.tech) y cualquier otro host, no. */
export default function robots(): MetadataRoute.Robots {
  const host = headers().get("host")?.split(":")[0] ?? "";
  if (!MARKETING_HOSTS.has(host)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // La app vive en otro dominio, pero en tekly.tech también responden
      // estas rutas (mismo deploy): no deben indexarse.
      disallow: ["/login", "/signup", "/forgot-password", "/reset-password", "/auth", "/admin", "/marketing"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
