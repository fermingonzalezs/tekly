import createMDX from "@next/mdx";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Los `.mdx` se importan como componentes (centro de ayuda). `pageExtensions`
  // incluye `mdx` para que `page.mdx` funcione, aunque nuestras páginas son
  // `.tsx` e importan el contenido desde `content/ayuda/*.mdx`.
  pageExtensions: ["ts", "tsx", "mdx"],
  // La app usa <img> (logos de organizaciones, SVG del kit): no necesita el
  // optimizador de imágenes de Next, que además es superficie de ataque.
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
