import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/** Contexto "organización" para trabajos sin sesión de usuario (el cron del
 *  resumen mensual). Mientras `conOrganizacion` está activo, `createServerClient`
 *  (`lib/auth/supabase.ts`) devuelve un cliente de **solo lectura** con
 *  service role **acotado a esa organización**: cada `select` agrega
 *  `organization_id = <org>` (o `id = <org>` en `organizations`). Así todas
 *  las `list*` de `lib/db` y la lógica pura se reusan tal cual, sin duplicar
 *  queries, y con el aislamiento entre organizaciones forzado acá (la RLS no
 *  corre con service role). */
const store = new AsyncLocalStorage<{ organizationId: string }>();

export function organizacionEnContexto(): string | undefined {
  return store.getStore()?.organizationId;
}

export function conOrganizacion<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
  return store.run({ organizationId }, fn);
}

type Cualquiera = Record<string | symbol, unknown>;

const ESCRITURAS = new Set(["insert", "update", "upsert", "delete"]);

function enlazar(target: object, prop: string | symbol): unknown {
  const v = Reflect.get(target, prop, target);
  return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
}

/** Envuelve un cliente de service role: solo lectura y siempre acotado a
 *  `organizationId`. Una escritura, un `rpc` o `storage` tiran un error en vez
 *  de ejecutarse. Un `select` sobre una tabla sin `organization_id` falla
 *  fuerte (columna inexistente) en vez de filtrar mal en silencio. */
export function soloLecturaDeOrganizacion<C extends object>(client: C, organizationId: string): C {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === "from") {
        return (tabla: string) => {
          const query = (target as Cualquiera).from as (t: string) => object;
          const q = query.call(target, tabla);
          const columna = tabla === "organizations" ? "id" : "organization_id";
          return new Proxy(q, {
            get(qt, qp) {
              if (qp === "select") {
                return (...args: unknown[]) => {
                  const sel = (qt as Cualquiera).select as (...a: unknown[]) => {
                    eq: (c: string, v: string) => unknown;
                  };
                  return sel.apply(qt, args).eq(columna, organizationId);
                };
              }
              if (typeof qp === "string" && ESCRITURAS.has(qp)) {
                throw new Error(`Cliente de solo lectura: "${qp}" no está permitido (${tabla})`);
              }
              return enlazar(qt, qp);
            },
          });
        };
      }
      if (prop === "rpc" || prop === "storage" || prop === "functions") {
        throw new Error(`Cliente de solo lectura: "${String(prop)}" no está permitido`);
      }
      return enlazar(target, prop);
    },
  });
}
