import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/auth/supabase";
import { REMEMBER_COOKIE_NAME } from "@/lib/auth/types";

// Páginas para usuarios sin sesión -- si ya hay una activa, rebotan a "/".
const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];
// Rutas que no rebotan en ningún sentido: `/auth/confirm` necesita correr
// tanto sin sesión (va a crearla) como con una ya activa (ej. alguien pide
// recuperar contraseña estando logueado en otra pestaña).
const ALWAYS_PUBLIC_PATHS = ["/auth"];

export async function middleware(request: NextRequest) {
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
