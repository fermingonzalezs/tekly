import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/auth/supabase";
import { REMEMBER_COOKIE_NAME } from "@/lib/auth/types";

// Páginas para usuarios sin sesión -- si ya hay una activa, rebotan a "/".
const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];
// Rutas que no rebotan en ningún sentido: `/auth/confirm` necesita correr
// tanto sin sesión (va a crearla) como con una ya activa (ej. alguien pide
// recuperar contraseña estando logueado en otra pestaña). En dev, `/qa` (la
// galería de componentes del plan 010) también: sirve para verificar
// visualmente sin sesión; en producción la página hace `notFound()`.
const ALWAYS_PUBLIC_PATHS = [
  "/auth",
  "/robots.txt",
  "/sitemap.xml",
  // Textos legales (plan 012): públicos, con o sin sesión.
  "/terminos",
  "/privacidad",
  "/cookies",
  // Centro de ayuda (plan 013): público e indexable.
  "/ayuda",
  // Demo sin cuenta (plan 014): pública, con o sin sesión.
  "/demo",
];

// Dominios de marketing (landing en tekly.tech). Si el host es uno de
// estos, `/` se reescribe (rewrite, no redirect -- el usuario sigue viendo
// tekly.tech/) a /marketing y no corre nada de la lógica de auth/cookies de
// abajo: la landing no necesita sesión. `tekly.localhost` es el alias para
// probarlo en dev (los .localhost resuelven a 127.0.0.1 sin /etc/hosts).
const MARKETING_HOSTNAMES = new Set([
  "tekly.tech",
  "www.tekly.tech",
  "tekly.localhost",
]);

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host")?.split(":")[0] ?? "";
  if (MARKETING_HOSTNAMES.has(hostname)) {
    // www → apex (301): una sola URL canónica para la landing.
    if (hostname === "www.tekly.tech") {
      const url = request.nextUrl.clone();
      url.hostname = "tekly.tech";
      url.port = "";
      url.protocol = "https:";
      return NextResponse.redirect(url, 308);
    }
    if (request.nextUrl.pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/marketing";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  const response = NextResponse.next({ request });
  const supabase = createMiddlewareClient(request, response);

  // Dispara el refresh de token si hace falta -- necesario para que la
  // sesión no expire silenciosamente entre requests (ver `applyServerStorage`
  // de @supabase/ssr, que este llamado activa vía `setAll`).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // "Recordarme" destildado en /login: la cookie de auth de @supabase/ssr
  // fuerza 400 días de vida pase lo que pase (no hay forma de acortarla por
  // configuración), así que la duración real la controla esta cookie propia
  // sin `maxAge` -- si el navegador se cerró, ya la borró solo y acá llega
  // ausente. Eso es la señal para cortar la sesión real.
  let sessionUser = user;
  if (user && !request.cookies.get(REMEMBER_COOKIE_NAME)) {
    await supabase.auth.signOut();
    sessionUser = null;
  }

  const pathname = request.nextUrl.pathname;
  if (ALWAYS_PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return response;
  }
  // Galería de QA: pública solo en dev, para revisar sin sesión.
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/qa")) {
    return response;
  }

  const isGuestOnlyPath = GUEST_ONLY_PATHS.some((p) => pathname.startsWith(p));

  if (!sessionUser && !isGuestOnlyPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (sessionUser && isGuestOnlyPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
