# 001 — Panel de administrador de plataforma (`/admin`)

- **Status**: TODO
- **Scope**: nueva sección fuera del grupo `(app)` — rutas, `lib/db/`, lógica
  pura, UI. Sin migraciones de base (ver "Base de datos" abajo).
- **Category**: feature nueva

## Contexto

Hoy el modelo de roles es 100% por-organización (`admin`/`vendedor`/
`tecnico`, `lib/auth/types.ts`) y RLS aísla cada tabla por
`organization_id`. No existe ningún concepto de "admin de plataforma" que
pueda ver todas las organizaciones a la vez — hay que crearlo desde cero
para que el dueño del SaaS pueda ver uso/volumen por organización y
gestionar roles/altas-bajas de usuarios sin entrar a Supabase Studio a mano.

Decisiones ya tomadas con el usuario (no reabrir sin confirmar con él):

- **Identidad del admin de plataforma**: allowlist de emails hardcodeada por
  variable de entorno — no columna nueva en `profiles`. Alcanza para 1-2
  personas; si hiciera falta escalar a un equipo de soporte más adelante,
  ahí sí tendría sentido una columna `is_platform_admin`.
- **Ubicación**: ruta dentro de la misma app (`/admin`), no subdominio
  nuevo.
- **Templates de mail**: **fuera de alcance**. El usuario pidió esto
  originalmente pero al aclarar que de todos modos hay que configurar los
  templates a mano en el dashboard de Supabase (no hay SMTP propio, ver
  CLAUDE.md "Qué falta antes de producción"), decidió que no vale la pena
  construir una UI para esto ahora.
- **Métricas**: combinar actividad de uso (login) + volumen de negocio por
  organización. **No hace falta instrumentar nada nuevo**: Supabase Auth ya
  guarda `last_sign_in_at` por usuario (vía
  `service.auth.admin.listUsers()`), y el volumen de negocio se deriva de
  las tablas que ya existen (`ventas`, `tickets`, `clientes`, `profiles`).

Alcance de "permisos" del panel: ver todas las orgs/usuarios, cambiar el rol
de cualquier usuario de cualquier organización, y activar/desactivar
(ban + baja lógica) cualquier usuario — la versión cross-org de lo que ya
existe en Configuración → Usuarios y roles. **Suspender una organización
completa queda fuera de este alcance** (requeriría una columna nueva +
enforcement en login/middleware — decisión de producto aparte).

## Base de datos

Verificado en vivo contra el proyecto Supabase real (`xdfdrzxrmfpnezyeeaeq`)
antes de escribir este plan: `organizations` y `profiles` tienen hoy
exactamente las columnas que este plan necesita (`organizations.plan`,
`created_at`; `profiles.rol`/`email`/`activo`/`organization_id`), RLS está
sano (`get_advisors` solo devuelve los WARN ya esperados — 3 RPCs
`security definer` intencionales + leaked password protection pendiente,
nada nuevo). **No se necesita ninguna migración para este plan.** Si al
implementar surge la necesidad de algo en Supabase (verificación de datos,
un índice), consultar antes de improvisar un cambio de schema.

## Identidad: `requirePlatformAdmin()`

`lib/auth/index.ts` ya tiene `requireUser()`/`requireRole(...)` como
precedente exacto a seguir. Agregar en ese mismo archivo:

```ts
const PLATFORM_ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const session = await requireUser();
  if (!PLATFORM_ADMIN_EMAILS.includes(session.email.toLowerCase())) {
    redirect("/");
  }
  return session;
}
```

`SessionUser.email` ya existe — no hace falta tocar `lib/auth/types.ts`.
Variable nueva en `.env.local` y `.env.local.example`:
`PLATFORM_ADMIN_EMAILS` (server-only, **sin** prefijo `NEXT_PUBLIC_`, lista
separada por comas). El dueño del SaaS sigue siendo un usuario normal con su
propia organización/perfil — esta variable solo lo habilita además a entrar
a `/admin`.

No se toca `middleware.ts`: `/admin` ya cae bajo la rama genérica de "exige
sesión" (no está en `GUEST_ONLY_PATHS` ni en `MARKETING_HOSTNAMES`). El
chequeo fino de "es admin de plataforma" vive en el layout de `/admin`,
mismo criterio que `requireRole("admin")` en Configuración (gate a nivel
página/layout, no en middleware).

## Rutas (fuera del grupo `(app)`)

`/admin` necesita su propio layout porque `app/(app)/layout.tsx` hoy fuerza
`getNegocio()` + `TopNav` + `RealtimeProvider` **de una sola organización**
— no tiene sentido para un panel cross-org. Mismo criterio que `/login`,
`/signup`, etc. (fuera de `(app)`, con su propio layout mínimo).

```
app/admin/
  layout.tsx                        requirePlatformAdmin() + shell mínimo (título, logout)
  page.tsx                          overview: StatCards + tabla de organizaciones
  organizaciones/[id]/
    page.tsx                        detalle de una org: datos + tabla de usuarios
    organizacion-client.tsx         interacción: Select de rol, confirmar activar/desactivar
    actions.ts                      "use server": requirePlatformAdmin() + revalidatePath
```

No se agrega a `lib/nav.ts` (ese archivo gatea por `Rol` de organización, no
por identidad de plataforma) ni al `TopNav`/`UserMenu` normal — se accede
tipeando `/admin` directo. Un link condicional en `UserMenu` queda como
mejora futura opcional, no entra en este alcance.

## Datos: `lib/db/admin.ts` (nuevo, `server-only`, service role)

Sigue el patrón de `lib/db/<dominio>.ts` pero usando
`createServiceRoleClient()` (`lib/auth/supabase.ts`) en vez del cliente
normal — es la única forma de leer todas las organizaciones a la vez (RLS
está diseñado para aislar por `organization_id`, no para un rol
transversal). El gate de autorización vive en las `actions.ts`/`page.tsx`
que llaman a este módulo (`requirePlatformAdmin()` primero), **nunca**
dentro del módulo mismo — mismo criterio que `createServiceRoleClient()` en
`inviteMember`/`deactivateMember` (`lib/auth/index.ts`).

Funciones:

- `listOrganizacionesRaw()`: trae `organizations` (id, nombre, plan,
  created_at) + `profiles` (id, organization_id, rol, nombre, email, activo)
  + conteos/sumas de `ventas` (organization_id, total_usd, fecha), `tickets`
  (organization_id, estado, created_at) y `clientes` (organization_id) —
  sin filtro de org porque va por service role. Además pagina
  `service.auth.admin.listUsers()` (loop hasta agotar páginas) para sacar
  `last_sign_in_at` por `id` de usuario.
- `getOrganizacionDetalle(orgId)`: mismo set pero acotado a una org, para la
  página de detalle.
- `setUserRolePlatform(targetProfileId, nuevoRol)` /
  `setUserActivoPlatform(targetProfileId, activo)`: igual que
  `setMemberRole`/`deactivateMember` de `lib/auth/index.ts` pero **sin** el
  chequeo `requireMemberOfCallerOrg` (el admin de plataforma puede tocar
  cualquier org) — van directo por `createServiceRoleClient()` actualizando
  `profiles.rol`/`profiles.activo` + `auth.admin.updateUserById` (ban) para
  desactivar, mismo mecanismo que `deactivateMember`.

## Cálculo puro: `lib/admin-metrics.ts` + `lib/admin-metrics.test.ts`

Siguiendo el patrón de `lib/dashboard.ts`/`lib/analiticas.ts` (página server
trae crudo vía `lib/db/`, un módulo puro sin Supabase calcula): recibe los
arrays crudos de `lib/db/admin.ts` y devuelve:

- Por organización: `{ orgId, nombre, plan, creadaEl, usuarios, usuariosActivos30d, ultimoLogin, ventasMes, facturacionMesUsd, ticketsAbiertos, clientesTotal }`.
- Por usuario (para el detalle): `{ id, nombre, email, rol, activo, ultimoLogin }`.

La ventana de "activo en los últimos 30 días" es el tipo de cálculo con
fecha que CLAUDE.md pide testear aparte (mismo cuidado que
`lib/analiticas.ts` con husos horarios) — tests con fecha fija pasada como
parámetro (mismo criterio que `clientes-inteligencia.ts`, que recibe
`hoy: Date` en vez de usar `new Date()` adentro, para que el test sea
determinístico).

## UI

Reusar primitivos existentes, nada nuevo:

- `StatCard` para el resumen (total orgs, total usuarios, usuarios activos
  30d, ventas del mes todas las orgs).
- `<Card>` + `<table>` para la tabla de organizaciones (hereda el estilo
  global de `app/globals.css`: headers banda índigo, cebra, etc. gratis).
- `Badge`/`lib/status.ts` si hace falta un chip de estado (activo/inactivo).
- En el detalle de organización: `Select` para cambiar rol, un confirm
  simple para activar/desactivar (mismo patrón que `ConfirmDialog` usado en
  Ventas para eliminar).
- Layout de `/admin` minimalista: sin `TopNav` normal (no aplica, no hay
  "organización actual"), un header simple con título + link de logout.

## Qué NO construir en este alcance

- Templates de mail (decisión explícita del usuario, ver "Contexto").
- Suspensión de organización completa (columna + enforcement — queda para
  más adelante si se decide).
- Cualquier tabla/migración nueva de tracking de actividad — no hace falta,
  `last_sign_in_at` de `auth.users` ya cubre "último login".
- Link visible en el nav normal hacia `/admin` — se accede por URL directa.

## Verificación

1. `npx tsc --noEmit` y `npx vitest run` (incluye el test nuevo de
   `lib/admin-metrics.ts`).
2. `npm run dev`, loguearse con un email presente en `PLATFORM_ADMIN_EMAILS`
   y entrar a `http://localhost:3100/admin` — confirmar que carga el
   resumen con datos reales de Supabase (aunque hoy probablemente sea una
   sola organización).
3. Confirmar el gate: con un usuario cuyo email NO está en
   `PLATFORM_ADMIN_EMAILS`, visitar `/admin` y verificar que redirige a `/`.
4. Entrar al detalle de una organización, cambiar el rol de un usuario y
   activar/desactivar otro — confirmar que el cambio se refleja (y que en
   Configuración → Usuarios y roles de esa misma org se ve el nuevo rol).
