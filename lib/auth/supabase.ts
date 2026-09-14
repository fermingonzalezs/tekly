import "server-only";
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Única pieza del repo que importa los SDKs de Supabase. El resto de la app
 * habla con `lib/auth` (sesión, login) y `lib/db` (datos) -- nunca con
 * `@supabase/*` directo. Cambiar de proveedor de auth/DB el día de mañana
 * significa reescribir este archivo y los de `lib/db`, no las páginas.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Cliente para Server Components / Server Actions / Route Handlers --
 * respeta RLS (corre como el usuario autenticado, o como anon sin sesión). */
export function createServerClient() {
  const cookieStore = cookies();
  return createSSRClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Se llama desde un Server Component sin permiso de escritura de
          // cookies -- el middleware (ver middleware.ts) refresca la sesión
          // en ese caso.
        }
      },
    },
  });
}

/** Cliente para middleware.ts -- lee/escribe cookies sobre NextRequest/
 * NextResponse en vez de `next/headers`. */
export function createMiddlewareClient(
  request: NextRequest,
  response: NextResponse,
) {
  return createSSRClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
}

/** Cliente con service role -- bypassa RLS por completo. Server-only,
 * nunca en un componente cliente. Reservado para operaciones privilegiadas
 * puntuales que no puede hacer el propio usuario vía RLS: alta de
 * organización en el signup, invitar un usuario nuevo. */
export function createServiceRoleClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en el entorno (ver .env.local.example)",
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
