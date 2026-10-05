import createMDX from "@next/mdx";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Los `.mdx` se importan como componentes (centro de ayuda). `pageExtensions`
  // incluye `mdx` para que `page.mdx` funcione, aunque nuestras páginas son
  // `.tsx` e importan el contenido desde `content/ayuda/*.mdx`.
  pageExtensions: ["ts", "tsx", "mdx"],
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
