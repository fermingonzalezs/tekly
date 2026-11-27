# CLAUDE.md

Guía para trabajar en este repo. Leer antes de agregar secciones o componentes.

## Qué es

SaaS multi-tenant real de gestión para negocios de venta y reparación de
iPhones: varias organizaciones, cada una con sus usuarios y 3 roles (admin,
vendedor, técnico). Cada organización ve únicamente sus propios datos.

- **Backend real en Supabase**: Postgres + Auth + RLS. Nada de datos mock
  para negocio — ver "Backend y multi-tenancy" abajo para el modelo completo.
- Self-serve: cualquiera se registra en `/signup`, crea su organización (queda
  como admin) e invita a otros usuarios por email.
- Supabase Realtime (Broadcast, sin tablas propias) se usa para el pub/sub de
  notificaciones entre pestañas/sesiones — igual que antes, no cambió.
- **Migración en curso**: el repo viene de un MVP puramente visual (mock data
  + `useState`) y se está pasando sección por sección a datos reales. Mientras
  una sección no esté migrada, sigue leyendo de `lib/mock-data.ts` — ver el
  estado actual en "Backend y multi-tenancy".

El foco sigue siendo que la navegación, el layout y los toasts en tiempo real
se sientan bien — pero ahora sobre datos y auth reales, no solo visual.

## Comandos

```bash
npm run dev          # http://localhost:3100
npm run build        # build de producción
npx tsc --noEmit     # typecheck (correr antes de dar por terminado un cambio)
npx vitest run       # tests unitarios (lógica de negocio pura, ver abajo)
```

No correr `next build` con el `dev` server levantado: pelean por `.next` y
tiran 500 intermitentes. Si cambiás variables de entorno (`.env.local`), hay
que **reiniciar el dev server** — Next solo las lee al arrancar.

Migraciones de base: no hay Supabase CLI linkeada localmente. Se escriben en
`supabase/migrations/` (versionadas en git, referencia de lo aplicado) y se
aplican al proyecto real vía las tools MCP de Supabase (`apply_migration`),
no a mano por el dashboard.

## Stack

Next.js 15 (App Router; `cookies()`/`headers()`/`params`/`searchParams` son async) · React 18 · TypeScript · Tailwind 3 · `lucide-react`.
Sin shadcn/ui instalado — los componentes son propios, en `components/ui/`.
Alias de import: `@/*` → raíz del repo.

Backend: `@supabase/supabase-js` + `@supabase/ssr` (solo dentro de
`lib/auth/supabase.ts`, ver abajo) · `zod` (validación en los boundaries) ·
`vitest` (tests de lógica pura, sin red).

## Arquitectura

```
app/(app)/<seccion>/page.tsx   server component: fetch inicial vía lib/db/
app/(app)/<seccion>/<seccion>-client.tsx   "use client": toda la interacción
app/(app)/<seccion>/actions.ts             "use server": mutaciones (requireUser() + revalidatePath)
app/(app)/layout.tsx      requireUser() + TopNav con la sesión real
app/(app)/loading.tsx     spinner mientras carga cualquier página del grupo
app/(app)/error.tsx       error boundary -- "Algo salió mal" + reintentar, en vez del crash genérico de Next
app/login/, app/signup/,
app/forgot-password/,
app/reset-password/       fuera del grupo (app) -- fondo blurreado + AuthModal
app/auth/confirm/route.ts único lugar que recibe los links de mail de Supabase Auth
app/marketing/           landing de tekly.tech (metadata propia, sin sesión) -- ver "Landing (tekly.tech)"
middleware.ts             protege rutas (sin sesión -> /login) + rewrite de tekly.tech/ → /marketing según host
components/ui/            primitivos reutilizables (ver abajo)
components/auth/          AuthModal, AppPreviewBackdrop, UserMenu
components/dashboard/     widgets del Dashboard
components/notifications/ Toaster (en layout) + NotificationsBell (en Topbar)
components/marketing/    secciones de la landing (nav, hero, features, showcase, ...)
lib/auth/                 sesión + login/signup -- única puerta a @supabase/* para auth
lib/db/<dominio>.ts       una por dominio migrado -- única puerta a @supabase/* para datos
lib/mock-data.ts          datos de ejemplo de las secciones TODAVÍA no migradas
lib/types.ts              tipos del dominio (contrato entre lib/db y las páginas)
lib/status.ts             estados (tickets, celulares, turnos, pagos) + tonos
lib/format.ts             formateo de moneda / fechas
lib/realtime.ts           pub/sub de eventos + describe() para el toast
lib/marketing/            appUrl/loginUrl/signupUrl -- CTAs de la landing a NEXT_PUBLIC_APP_URL
lib/cajas.ts, lib/ventas.ts  lógica de negocio pura (sin Supabase) con tests en *.test.ts
supabase/migrations/      schema versionado, aplicado vía MCP al proyecto real
components/brand/         TeklyLogo: único punto de uso del kit de logos (ver "Marca")
public/                   favicon.ico + og-image.png (placeholder) + tekly-logo-kit/ (logos) -- compartidos por toda la app
```

Páginas server por defecto; `"use client"` solo donde hay interacción
(filtros, dialogs, estado local, `publish`).

### Landing (tekly.tech)

`app/marketing/` + `components/marketing/` + `lib/marketing/`: la landing de
marketing vive en este mismo proyecto (un solo deploy, dos dominios), sin
sesión ni Supabase. `middleware.ts` la resuelve por **host**: si el request
viene de `tekly.tech` / `www.tekly.tech` (o `tekly.localhost` en dev, los
`.localhost` resuelven a 127.0.0.1 solos), reescribe `/` → `/marketing`
(rewrite, no redirect -- el usuario sigue viendo `tekly.tech/`) y no corre
nada de auth/cookies. Los CTAs ("Ingresar" / "Probar gratis") son absolutos
a `NEXT_PUBLIC_APP_URL` (default `https://sistema.tekly.tech`) vía
`lib/marketing/app-url.ts`. En la landing NO aplican las reglas "forbidden
defaults" de la app de gestión (gradientes/parallax OK, ver plan-landing);
sí `prefers-reduced-motion` (`useReducedMotion` en reveal/hero/showcase --
la única parte del repo que lo maneja).

**SEO de la landing**: `app/marketing/layout.tsx` fija title/description/
keywords, canonical `/`, Open Graph/Twitter (`es_AR`) con imagen **absoluta**
(`https://tekly.tech/og-image.png`, 1200×630 generada con el logo real; si se
cambia el claim, regenerarla) y `robots: index`. El root layout
(`app/layout.tsx`) es `noindex, nofollow` — **todo lo que no sea la landing no
se indexa** (la app, `/login`, `/signup`, …); una página pública nueva
(legales, ayuda) tiene que pisar `robots` con `index: true`, agregarse a
`app/sitemap.ts` y quitarse del `disallow` de `app/robots.ts`. `robots.ts`
decide por **host** (tekly.tech indexable; sistema.tekly.tech y cualquier otro
`Disallow: /`); `middleware.ts` deja pasar `/robots.txt` y `/sitemap.xml` sin
sesión y redirige `www.tekly.tech` → `tekly.tech` (308). `lib/marketing/seo.ts`
tiene `SITE_URL` y el JSON-LD (Organization + WebSite + SoftwareApplication) —
con `offers` (precios mensuales de `lib/planes.ts`).

**Legales** (plan 012): `/terminos`, `/privacidad` y `/cookies` viven en
`app/(legal)/` (TSX con `LegalLayout`/`Seccion`/`Lista`, sin dependencias),
públicas en ambos hosts (`ALWAYS_PUBLIC_PATHS` en el middleware) y linkeadas
desde el footer de la landing y el signup. `lib/legal.ts` es la fuente única:
`TERMINOS_VERSION` (subirla cuando cambie un texto), `EMPRESA` (datos
pendientes `[…]`) y **`LEGAL_BORRADOR`**: mientras sea `true` las páginas
existen **solo en desarrollo** (404 en producción) con el aviso de borrador,
y quedan ocultos/inactivos: los links del footer, el checkbox del signup (no
se registra aceptación), el aviso de cookies y la re-aceptación obligatoria. Pasarlo a `false` solo después de la
revisión de un abogado y de completar `EMPRESA`. Aceptación: checkbox
obligatorio en `/signup` (zod `acepta` + server action) que guarda
`profiles.terminos_version`/`terminos_aceptados_at`; con `LEGAL_BORRADOR=false`,
`(app)/layout.tsx` manda a `/aceptar-terminos` a invitados y usuarios que no
aceptaron la versión vigente (`requiereAceptarTerminos`, `aceptarTerminos()`
por service role). El aviso de cookies (`AvisoCookies`) es **informativo**
(solo cookies necesarias, sin "rechazar"): si se agrega analytics/marketing o
cualquier script de terceros hay que actualizar la tabla de `/cookies` y
convertirlo en banner de consentimiento previo.

**Mobile de la landing** (revisada a 390 y 360 px; escritorio no se toca):
el `h1` del hero usa `min(3rem, (100vw-2rem)/7.6)` en mobile para que
"ORGANIZACIÓN," nunca sea más ancho que la pantalla (desde `sm` vuelve al
`clamp` de escritorio); los CTA del hero van apilados a ancho completo; el
feed del hero parte los textos en 2 líneas en vez de cortarlos con "…"
(`sm:truncate`); las secciones separan `pb-20` en mobile y `sm:pb-36` en
escritorio. Un hijo de una grilla CSS **no** se achica por debajo de su
contenido: las grillas de la landing que llevan tablas/gráficos usan
`grid-cols-[minmax(0,1fr)]` o `[&>*]:min-w-0` (sin eso, el panel de
Analíticas y las tarjetas de módulos se pasaban del borde). Los montos de
las mini-tablas llevan `whitespace-nowrap`. Probar siempre a 360 px, no solo
a 390.

### Centro de ayuda (plan 013)

Manual de usuario y tutoriales, público e indexable. **El contenido vive en
el repo**: `content/ayuda/<seccion>/<slug>.mdx` (frontmatter `titulo`,
`resumen`, `seccion`, `roles`, `orden`, `actualizado`), versionado con el
código — **cambió una pantalla → actualizá su artículo en el mismo PR**.
`lib/ayuda.ts` (puro, con test) parsea/valida el frontmatter, arma el índice
por sección/rol, los relacionados, el anterior/siguiente y la búsqueda;
también `headings()` (índice lateral) y `slugify()` (ids de ancla).

Rutas: `app/ayuda/` (home buscable + `[seccion]/[slug]` con
`generateStaticParams`/`generateMetadata`). El MDX se compila con
`next-mdx-remote/rsc` + `gray-matter` (ver `next.config.mjs`,
`mdx-components.tsx`); los componentes propios (`Paso`, `Aviso`, `Captura`,
`Video`) están en `components/ayuda/mdx.tsx` y usan el sistema de diseño.
`/ayuda` es público en ambos hosts (`ALWAYS_PUBLIC_PATHS`) e indexable
(metadata propia, canonical, JSON-LD `Article`+`BreadcrumbList`, entrada en
`sitemap.ts`). **Capturas con datos demo, nunca de una organización real.**

Ayuda contextual: `Section` acepta `ayuda={<seccion>}` y muestra un `?`
(`aria-label`) en el `Topbar` que abre `/ayuda/<seccion>` en una pestaña
nueva. Regla: si una guía es solo-admin, el link no debe ofrecerse a un
vendedor/técnico (`articuloDeSeccion` filtra por rol). Videos ≤ 90 s con
`<video preload="metadata">`; si se agrega un reproductor de terceros, hay
que actualizar `/cookies` (plan 012).

### Demo sin cuenta (plan 014)

`/demo` (redirige a `/demo/dashboard`) y `/demo/ventas` son públicas, sin
sesión y sin Supabase: el visitante prueba Dashboard + Ventas con datos de
ejemplo que viven **solo en su pestaña** (`sessionStorage`, clave
`tekly:demo:v1`). Públicas vía `ALWAYS_PUBLIC_PATHS` en `middleware.ts`;
heredan `noindex` del root layout.

- **Aislamiento por construcción**: nada bajo `app/demo/`, `lib/demo/` ni
  `components/demo/` importa (en runtime) `@/lib/db/*`, `@/lib/auth*`,
  `@supabase/*` ni `server-only` — lo verifica
  `lib/demo/aislamiento.guard.test.ts` (los `import type` sí se permiten, se
  borran al compilar).
- `lib/demo/seed.ts` (`crearSeedDemo(hoy)`, determinista), `lib/demo/store.tsx`
  (`DemoProvider`/`useDemo`: estado + espejo en `sessionStorage`; el primer
  render usa el seed para no romper la hidratación), `lib/demo/operaciones.ts`
  (`crearVentaDemo`/`eliminarVentaDemo`, puros) y `lib/demo/ventas-query.ts`
  (`consultarVentas`: filtro/orden/paginación en memoria, mismas reglas que la
  SQL real).
- `VentasClient` acepta `basePath` (default `/ventas`), `acciones` (default:
  las server actions) y `modoDemo` (oculta cuenta corriente y canje);
  `DashboardAdmin`/`RecentSales` aceptan `ventasHref`; `RealtimeProvider` acepta
  `enabled={false}`. La demo monta el provider **sin transporte** (nunca con el
  `organizationId` "demo", sería un canal compartido entre visitantes).
- Usuario fijo admin (`lib/demo/usuario.ts`), nav propia
  (`components/demo/demo-nav.tsx`) y banner con "Reiniciar demo"
  (`components/demo/demo-banner.tsx`). CTAs "Ver demo" en la landing y el login.

## Backend y multi-tenancy

Proyecto Supabase real: `tekly` (`xdfdrzxrmfpnezyeeaeq`, región `sa-east-1`).
Acceso vía MCP con las tools `mcp__plugin_supabase_supabase__*` (el conector
`claude_ai_Supabase` original queda para otra cuenta, no usarlo acá).

### Modelo de datos

- `organizations (id, nombre, plan, created_at)`.
- `profiles (id → auth.users, organization_id, roles text[], rol, nombre,
  alias, email, activo)` — una fila por usuario. **Un usuario pertenece a una
  sola organización** (no hay tabla de membresías N:M; si hiciera falta
  multi-org el día de mañana, es una migración de datos acotada).
  **`roles` es la fuente de verdad de los permisos** (1 a 3: `admin`,
  `vendedor`, `tecnico`; `admin` absorbe al resto → `['admin']`). Los
  permisos de la app son la **unión** (`tieneRol` en `lib/roles.ts`).
  **`rol` se conserva como rol principal derivado** por el trigger
  `profiles_normalizar_roles` (`admin` > `tecnico` > `vendedor`): existe
  porque `current_user_rol() = 'admin'` está en ~15 policies y en el panel de
  plataforma, y como solo se compara contra `admin` sigue siendo correcto.
  El código de la app **no** usa `rol` para decidir permisos.
- Una tabla por dominio de negocio (`clientes`, `celulares`, `notebooks`, `repuestos`,
  `otros_items`, `movimientos_stock`, `proveedores`, `tickets`, `servicios`,
  `turnos`, `ventas`, `venta_items`, `cajas`, `movimientos_caja`,
  `conciliaciones`, `movimientos_cc`, `compras`, `compra_items`,
  `listas_difusion`, `variantes`, `tiendas`), todas
  con `organization_id` (con `DEFAULT current_user_org_id()` — un insert de
  la app no necesita pasarlo a mano, y la policy `WITH CHECK` lo sigue
  validando igual si alguien lo manda). Columnas en snake_case; los tipos de
  `lib/types.ts` son camelCase — el mapeo vive en cada `lib/db/<dominio>.ts`.
- Estructuras anidadas (`Venta.pagos`, `Ticket.servicios`, `Turno.pagos`,
  `Conciliacion.lineas`, `Compra.items`, `OtroItem.unidades`,
  `ListaDifusion.secciones`) se guardan como `jsonb` tal cual el shape de
  `lib/types.ts` — son snapshots embebidos, no relaciones vivas. **Excepción:
  `Venta.items` es la única estructura anidada con tabla propia
  (`venta_items`, 1 fila por `VentaItem`, `venta_id → ventas.id on delete
  cascade`, `celular_id → celulares.id` / `notebook_id → notebooks.id`
  nullables, mismas 4 policies de RLS + `DEFAULT current_user_org_id()` que
  cualquier tabla de negocio)** — se sacó del jsonb a propósito para poder
  agregar en SQL por ítem/categoría en vez de traer todas las ventas a la
  app y sumar en JS; es lo que habilita `margenPorTipo` real en Analíticas
  (`lib/analiticas.ts`). `lib/db/ventas.ts` arma `Venta.items` con un select
  embebido (`venta_items(...)`) — el contrato de `Venta`/`VentaItem` hacia
  el resto de la app no cambió.
- Contadores derivados (`Cliente.compras/reparaciones/gastadoUsd`) **no se
  guardan como columnas** — se calculan en el momento contra `ventas`/
  `tickets` en `lib/db/clientes.ts`, para que nunca puedan desincronizarse.
- `Turno.dayOffset` del tipo TS es un campo **calculado**, no persistido: la
  tabla `turnos` guarda `fecha date` + `hora time` reales; `lib/db/turnos.ts`
  calcula el offset contra hoy al mapear la fila.

### RLS — reglas de oro

Todas las tablas de negocio tienen RLS habilitado, 4 policies
(`select`/`insert`/`update`/`delete`) `to authenticated using/with check
(organization_id = current_user_org_id())`. `organizations`/`profiles` solo
tienen policy de `select` — altas y cambios de roles van por `service role`
(signup/invite) o por las RPC `update_own_profile`/`set_member_roles`
(`security definer`, cada una valida `auth.uid()`/rol adentro).
`set_member_roles` valida además que no quede la organización **sin ningún
admin activo**; `current_user_tiene_rol(r)` queda para policies nuevas que
pregunten por un rol puntual (no reemplaza a `current_user_rol`).

Errores reales que ya nos mordieron una vez — no repetirlos:

- **RLS no alcanza sin GRANT de SQL.** Crear tablas por migración (en vez del
  flujo del dashboard, que lo hace solo) no te da automáticamente
  `SELECT/INSERT/UPDATE/DELETE` para `authenticated`/`service_role` — sin eso
  da "permission denied" antes de que la policy de RLS entre en juego. Toda
  tabla nueva necesita su `grant ... to authenticated` explícito.
- **Una función RLS que lee su propia tabla protegida recursiona.**
  `current_user_org_id()` lee `profiles`, que tiene una policy que llama a
  `current_user_org_id()` — sin `security definer` esto es recursión infinita
  ("stack depth limit exceeded"). Cualquier función helper de RLS que
  necesite leer una tabla con RLS propia tiene que ser `security definer`.
- **Sin `DEFAULT organization_id`, todo insert que no lo pase a mano rompe la
  policy** (`organization_id` queda `NULL`, que nunca es igual a nada). Toda
  tabla de negocio nueva necesita `alter column organization_id set default
  current_user_org_id()`.
- `to authenticated` solo (sin predicado de pertenencia) es autenticación sin
  autorización — siempre con `organization_id = current_user_org_id()`.
  Policies de `update` llevan `using` **y** `with check` (sin el segundo,
  se puede reasignar `organization_id` a otra fila). Nunca `auth.role() =
  'authenticated'` (deprecado, rompe con anon sign-ins) — el rol va en `to`.

**Plan y rol también en la base (plan 016,
`20261011200000_rls_plan_y_rol.sql`)**: la anon key es pública, así que las
server actions no alcanzan — un usuario autenticado puede escribir directo
contra la API REST. Las policies de `insert`/`update`/`delete` de las tablas
de negocio exigen `org_puede_escribir()` (espejo de `estadoDeAcceso`,
`lib/planes.ts`: si cambia una regla de plan, cambiar **las dos**) y el
`delete` de las tablas cuyo borrado es admin-only exige
`current_user_rol() = 'admin'`. Excepción deliberada: `ventas`, `venta_items`,
`venta_item_repuestos`, `movimientos_caja`, `movimientos_cc` y `compras` no
piden rol admin al borrar, porque `createVenta` compensa una falla borrando
lo que alcanzó a crear con la sesión de un vendedor. **Una tabla nueva** lleva
`org_puede_escribir()` en sus 3 policies de escritura. Pendiente: la lectura
de `costo_usd`/margen por un vendedor sigue siendo solo de UI (haría falta
privacidad por columna o una vista).

Antes de dar una migración por terminada: `get_advisors` tipo `security` — no
debería aparecer nada nuevo más allá de los 2 `WARN` esperados (RPC
`security definer` llamables por `authenticated`, es intencional) y "leaked
password protection" (pendiente, ver "Qué falta").

### `lib/auth/` — única puerta a Supabase Auth

`types.ts` (`SessionUser`, `Rol`, `EmailLinkType`, `REMEMBER_COOKIE_NAME`),
`supabase.ts` (los tres clientes: `createServerClient` para Server
Components/Actions, `createMiddlewareClient` para `middleware.ts`,
`createServiceRoleClient` para altas privilegiadas — **server-only**, nunca
en un componente cliente), `index.ts` (`requireUser()`, `requireRole(...)`,
`signIn`/`signUp`/`signOut`/`inviteMember`, `requestPasswordReset`/
`verifyEmailLink`/`updatePassword` para el flujo de mail,
`updateOwnProfile`/`setMemberRoles`), `validation.ts` (schemas de `zod` para
los forms de auth). `requireRole(...)` / `requireRoleEscritura(...)` aceptan
**cualquiera** de los roles dados: usan `tieneRol` (`lib/roles.ts`), que
devuelve true si el usuario tiene alguno (y siempre true para `admin`).

`requireUser()` en `app/(app)/layout.tsx` protege todo lo que cuelga de ese
grupo; `middleware.ts` además redirige a `/login` antes de que la página
llegue a renderizar. Ninguna página/componente importa `@supabase/*`
directo — todo pasa por `lib/auth` (sesión) o `lib/db/<dominio>` (datos).

Los tres clientes de `supabase.ts` comparten un `fetch` custom
(`fetchWithClockSkewRetry`) pasado vía `global.fetch`: un JWT recién emitido
(login, signup, verificar link de mail) puede pegarle a un nodo de
PostgREST cuyo reloj todavía está un instante atrás del que lo firmó — 401
`PGRST303` ("JWT issued at future") aunque el token es válido. Es un
desajuste de reloj transitorio entre nodos de Supabase (se ve en los logs
de `auth`/`edge_logs`, no es un bug de la app) que se resuelve solo en menos
de un segundo, así que un reintento único alcanza.

### `lib/db/<dominio>.ts` — patrón por sección migrada

Un archivo por dominio (`clientes.ts`, `inventario.ts`, `reparaciones.ts`,
`ventas.ts`, …), cada uno con `import "server-only"` y funciones tipadas que
devuelven los tipos de `lib/types.ts` (mapeo snake_case → camelCase incluido).
Página migrada = 3 archivos en `app/(app)/<seccion>/`:

- `page.tsx` — server component, hace el fetch inicial vía `lib/db/` y se lo
  pasa como prop al client component.
- `<seccion>-client.tsx` — todo lo que hoy es interactivo (antes vivía todo
  en el `page.tsx` mock: tabs, dialogs, filtros, estado local).
- `actions.ts` — `"use server"`, una función por mutación, siempre
  `requireUser()` primero y `revalidatePath("/<seccion>")` al final.

`publish(...)` de `lib/realtime.ts` sigue disparándose desde el cliente
(necesita `window`), después de que la server action confirmó el cambio —
nunca desde dentro de un `lib/db/*` o `actions.ts`.

### Auth: páginas y flujo

`/login`, `/signup`, `/forgot-password` y `/reset-password` están fuera del
grupo `(app)`, con su propio layout: fondo = `AppPreviewBackdrop` (maqueta
muda del shell de la app, blureada, `components/auth/app-preview-backdrop.tsx`
— hoy muestra la tab "Ventas" con una tabla de ventas recientes, no gráficos:
un gráfico de barras/donut blureado se lee mal, una tabla con el patrón
cebra global se banca el blur bien) + `AuthModal`
(`components/auth/auth-modal.tsx`, header índigo parecido al de `Dialog` con
`accent`, pero **no** es un `Dialog` -- no le aplica su regla de footer a
mano). El botón primario de cada form usa `<Button chip>` (login/signup; ver
"Botones"). `UserMenu`
(`components/topnav.tsx`) reemplaza el avatar simple: muestra nombre/rol y
permite cerrar sesión o editar nombre/alias (`updateOwnProfile`).

Signup (`lib/auth/index.ts`): crea el usuario de auth, y si algo falla
después (org o perfil), hace **rollback** del usuario recién creado — sin
esto queda una cuenta fantasma que bloquea reintentar con el mismo email.
El form pide "Confirmar contraseña" (validado con `zod`,
`password === confirmPassword`, `lib/auth/validation.ts`). Si Supabase tiene
"Confirm email" activo, `signUp` no devuelve sesión — el form no asume login
inmediato, muestra "revisá tu mail" en vez de mandar a `/dashboard`.

**Recordarme**: `@supabase/ssr` fuerza siempre 400 días de vida en su propia
cookie de auth, no se puede acortar por configuración. La duración real la
controla una cookie propia (`tekly-remember`, `REMEMBER_COOKIE_NAME` en
`lib/auth/types.ts`): tildado en `/login` → persiste (`maxAge` largo);
destildado → cookie de sesión del navegador (sin `maxAge`). `middleware.ts`
la usa como señal: si la sesión de Supabase sigue viva pero esa cookie ya no
está, asume que el navegador se cerró y corta la sesión. Toda vía que deja a
alguien logueado (login, signup sin confirmación pendiente, aceptar
invitación, confirmar cuenta, recuperar contraseña) tiene que llamar
`setRememberCookie` — si no, la próxima request encuentra la cookie ausente
y `middleware.ts` cierra la sesión sola pensando que el navegador se cerró.

**Flujo de mail** (`app/auth/confirm/route.ts`): único lugar de la app que
recibe los links de Supabase Auth (confirmar cuenta, invitación, recuperar
contraseña). **Editar los templates del dashboard es opcional** — sin SMTP
propio el editor de templates no está disponible, así que la ruta soporta
las tres formas en las que puede volver la credencial:

1. `?token_hash=...&type=...` — template propio
   (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<tipo>`);
   lo verifica `verifyEmailLink` (`lib/auth/index.ts`).
2. `?code=...` — template **default** (`{{ .ConfirmationURL }}`): el link va
   al `/auth/v1/verify` de Supabase, que verifica el token él mismo y rebota
   al `redirect_to` con el code del flujo PKCE (el que fuerza
   `@supabase/ssr`). Lo canjea `exchangeEmailCode`. El `code_verifier` vive
   en una cookie del navegador que pidió el mail → **el link tiene que
   abrirse en ese mismo navegador**.
3. Nada en la query — la sesión (o el error del link vencido) viene en el
   fragmento `#access_token=…`, que nunca llega al server. Pasa el caso de
   las invitaciones (`inviteUserByEmail` del admin API no usa PKCE). La ruta
   redirige a `app/auth/confirm/hash/` (página cliente) que lee el fragmento,
   lo borra de la barra de direcciones y le pasa los tokens a
   `setSessionFromTokens` por server action.

**Invitados → `/bienvenida`**: `inviteMember`/`resendInvite` mandan
`user_metadata.debe_crear_contrasena = true` y `redirectTo` a `/bienvenida`
(también es el default de `type=invite` en la ruta y en `hash-callback`). El
invitado entra con la sesión del link y nunca eligió contraseña: ahí confirma
su nombre y crea la contraseña (`crearContrasenaInvitado`, `bienvenidaSchema`),
que baja el flag en el mismo `updateUser`. `SessionUser.debeCrearContrasena`
hace que el layout `(app)` lo mande a `/bienvenida` hasta que la cree.
Invitados anteriores a este flag no lo tienen: si se quedan sin sesión, usan
«¿Olvidaste tu contraseña?».

Lo que **sí** hay que configurar a mano (es gratis, Authentication → URL
Configuration): Site URL y Redirect URLs con el origen de la app
(`http://localhost:3100/**` en dev). `lib/auth` arma el `redirectTo` /
`emailRedirectTo` de cada mail con `authCallbackUrl()` a partir de
`NEXT_PUBLIC_SITE_URL` (o de los headers de la request si falta) — si ese
origen no está permitido, Supabase lo ignora y manda al Site URL, que por
default es `localhost:3000` (puerto equivocado para este repo).
`/forgot-password` dispara el mail
(`requestPasswordReset`, siempre "éxito" aunque el mail no exista, para no
filtrar qué cuentas están registradas) y `/reset-password` es la pantalla
para poner la contraseña nueva (`updatePassword`), a la que el link de
recuperación te deja con una sesión temporal.

Ambiente de desarrollo: en Supabase Dashboard → Authentication → Providers →
Email, "Confirm email" puede estar desactivado en local (el email service
default de Supabase tiene rate limit muy bajo, pensado solo para pruebas
puntuales) — ya existen las pantallas para recibirlo (arriba), así que
activarlo es seguro cuando haga falta probar el flujo completo. Ver "Qué
falta" para lo pendiente antes de producción (Site URL, Redirect URLs,
Email Templates, SMTP propio).

### Variables de entorno

`.env.local` (gitignored, ver `.env.local.example`):
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (públicas) +
`SUPABASE_SERVICE_ROLE_KEY` (secreta, **nunca** con prefijo `NEXT_PUBLIC_`,
server-only) + `NEXT_PUBLIC_SITE_URL` (origen público de la app: base de los
links de mail de Auth, ver "Flujo de mail"; si falta se deduce de los headers
de la request) + `ANTHROPIC_API_KEY` (secreta, server-only: "Leer con IA" de
Importar datos; sin ella esa opción responde "no configurada"). Cambios acá
requieren reiniciar `npm run dev`.

### Testing

`vitest` para lógica de negocio **pura** (sin Supabase, sin red) — cuando una
sección tiene un cálculo no trivial (conciliación de caja, pago dividido,
gating por rol), esa lógica se extrae a `lib/<algo>.ts` con su
`lib/<algo>.test.ts` al lado, y el componente/server action la importa en vez
de reimplementarla inline. Ver `lib/cajas.ts`, `lib/ventas.ts`, `lib/nav.ts`
(`navForRole`) como referencia. No se exige cobertura de UI ni de las
queries a Supabase.

### Estado de la migración (actualizar a medida que avanza)

**Las 12 secciones están migradas** (Clientes, Inventario, Reparaciones,
Ventas, Turnos, Cajas, Compras, Cuentas corrientes, Difusión, Analíticas,
Dashboard, Configuración) — no queda ninguna página en el patrón mock viejo.
**Plan 018**: la entidad de stock «Equipo» pasó a **Celular** (tabla
`celulares`, columnas `venta_items.celular_id`/`turnos.celular_ids`, valor
`categoria: "celular"`) y se sumó **Notebook** como categoría de Inventario y
de venta (`notebooks`, `venta_items.notebook_id`, `categoria: "notebook"`,
rubro «Notebooks» — 5 rubros, `CHART_COLORS` ya tiene 5 pasos). Notebooks es
unidad única con número de serie, se vende desde Nueva venta (queda `vendido`,
aparece en Ítems vendidos con su serie, y el comprobante/garantía la usa) y se
devuelve a `disponible` al borrar la venta. Quedó **fuera de alcance** (solo
no se rompe): Turnos con notebooks, pestaña de notebooks
en Analíticas → Inventario, Recuentos de notebooks, y
costos/margen de notebooks por modelo en Analíticas.
`clientesDemografia` también pasó a real: `clientes.fecha_nacimiento`
(opcional, se carga en el alta) + `lib/clientes.ts` (`demografiaClientes()`,
lógica pura con test) — un cliente sin esa fecha cargada simplemente no
entra en el cálculo.

Sigue en `lib/mock-data.ts` un puñado de datasets puntuales porque falta
trackear el dato que los sustenta, no por falta de migrar la sección: en
Analíticas `tiempoPorFalla` (no hay timestamp de "listo/entregado" en
`tickets`) y `rendimientoTecnicos` (no hay reingresos ni calificación en
ningún lado). Cada caso tiene un comentario en el código explicando por qué
sigue en mock — agregar esas columnas es una decisión de producto, no algo a
resolver de paso en una migración. La meta del mes (`target`) ya tiene owner
y es 100% real: `organizations.objetivo_mes_usd`, editable en Configuración
→ Datos del negocio (`getNegocio()`/`updateNegocio()` en
`lib/db/configuracion.ts`). `margenPorTipo` pasó a real (`lib/analiticas.ts`,
con test) desde que `VentaItem` tiene tabla propia (`venta_items`, ver
"Backend y multi-tenancy") — mismo rubro Celulares/Notebooks/Reparaciones/Accesorios/
Otros que `ventasPorRubro` del dashboard (`categoriaDe`/`RUBRO_LABEL`
compartidos vía `lib/ventas.ts`), agregando `costoUsd`/`precioUsd` por ítem;
un ítem sin `costoUsd` cargado cuenta como operación pero no entra en el
cálculo de margen.

### Seguridad (revisión integral, plan 016)

- `safeNextPath` (`lib/auth/next-path.ts`, con test) rechaza `\` y
  caracteres de control (open redirect `/\evil.com`).
- `middleware.ts`: el host de marketing ya **no** saltea la auth — solo pasan
  sin sesión las rutas públicas; las rutas públicas coinciden por segmento
  (`/demo`, `/demo/x`, no `/demoX`).
- Logo (`uploadLogo`): solo PNG/JPG/WebP, ≤ 2 MB, extensión derivada del MIME.
- Reportes de bug: tope de largo y 3 por minuto por usuario (cada uno manda
  un mensaje a Telegram); `reportarBugAction` devuelve `{ error }`.
  Se leen en **`/admin/reportes`** (panel de plataforma; «Panel de
  plataforma» en el `UserMenu` si el email está en `PLATFORM_ADMIN_EMAILS`,
  `esAdminPlataforma`). «Resolver» guarda qué se arregló
  (`reportes_bugs.estado/respuesta/resuelto_at`,
  `20261125000000_reportes_bugs_resolucion.sql`) y al usuario que reportó le
  aparece en la **campanita** (persistida: `listResolucionesPropias` en el
  layout `(app)`, no vista = no leída hasta abrirla →
  `marcarResolucionesVistasAction` pone `visto_at`). Todo por service role
  filtrado por el id de la sesión: la tabla sigue sin policies de
  select/update. Editar la respuesta la vuelve a mostrar como nueva.
- Actions de Cajas/Compras/Cuentas corrientes exigen `admin`/`tecnico` (antes
  solo sesión; la nav las ocultaba al vendedor pero la action no).
- `next.config.mjs`: headers de seguridad (nosniff, X-Frame-Options
  SAMEORIGIN, Referrer-Policy, Permissions-Policy, HSTS) e
  `images.unoptimized` (la app usa `<img>`, no `next/image`). **Falta CSP**:
  requiere inventariar scripts (Turnstile, Sora, JSON-LD) y probarla en
  report-only primero.
- Pendiente: canales de Realtime **privados** (hoy `crm-events:<orgId>` es un
  Broadcast público: quien conozca el UUID de la org escucha), Turnstile
  obligatorio en producción, y `next@16` (el único advisory que queda en
  `next` es el `postcss` que trae adentro, solo build-time).

### Qué falta antes de producción

- ~~**SMTP propio para Auth**~~ — **hecho** (Resend). Con eso los mails
  llegan a cualquier usuario y el editor de Email Templates queda disponible
  (los templates de `supabase/email-templates/` ya apuntan al kit v2).
- **SMTP propio también es lo que destraba los templates**: con el email
  service default, Supabase solo entrega mails a direcciones que son miembros
  de la organización del proyecto (nadie más los recibe) y el editor de Email
  Templates no está disponible. La app no depende de los templates (ver
  "Flujo de mail"), pero sí de esto para que el mail le llegue a un usuario
  real.
- Configuración manual en el dashboard de Supabase, proyecto `tekly` (no hay
  tool de MCP para Auth email templates ni Site URL, es 100% a mano):
  Site URL + Redirect URLs (Authentication → URL Configuration) — **esto es
  obligatorio y gratis**, sin el origen de la app en Redirect URLs los links
  de mail vuelven al Site URL default — y activar "Confirm email"
  (Authentication → Providers → Email). Los 3 Email Templates (Confirm signup
  / Invite user / Reset Password) con
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<tipo>` son
  **opcionales** (queda un link más lindo y sin la restricción de "mismo
  navegador" del PKCE) — ver "Auth: páginas y flujo".
- **Leaked password protection** (Authentication → Policies): desactivada
  por default, activar antes de producción.

### Resumen mensual (plan 022)

Una vez por mes se guarda, **congelado**, el resumen del mes que cierra
(`resumenes_mensuales`: una fila por organización y mes, `datos jsonb`
versionado por `RESUMEN_VERSION` + columnas sueltas para listar). **Híbrido**:
ventas/reparaciones/compras/caja salen de las fechas del mes; inventario,
saldos y patrimonio son una **foto** (no se reconstruye), por eso se guarda al
cierre y `foto_fiable` dice si se generó dentro de los 3 días posteriores.

- **Cron**: `pg_cron` (`resumen-mensual`, `30 4 1 * *` = 01:30 hora Argentina
  del día 1) + `pg_net` solo **disparan** `POST /api/cron/resumen-mensual`; el
  cálculo es TypeScript (`lib/resumen-mensual.ts`, puro y con test, reusa los
  `resumen*` de Analíticas). La ruta exige `Authorization: Bearer
  <CRON_SECRET>` (`/api/cron` es público en `middleware.ts`; sin
  `CRON_SECRET` queda cerrada) y es idempotente (upsert por org+mes).
- **Secretos fuera del repo**: Vault tiene `cron_app_url` y `cron_secret`; la
  app necesita `CRON_SECRET` con **el mismo valor** (`select decrypted_secret
  from vault.decrypted_secrets where name = 'cron_secret'`). Si se cambia el
  dominio de producción hay que actualizar `cron_app_url`.
- **Sin sesión de usuario**: `lib/auth/scope.ts` (`conOrganizacion`) hace que
  `createServerClient()` devuelva un cliente de **service role de solo lectura
  acotado a la organización** (cada `select` agrega `organization_id`; las
  escrituras y `rpc` tiran). Es lo que permite reusar todas las `list*` de
  `lib/db` desde el cron. **No usarlo para nada que escriba**: la escritura va
  por `createServiceRoleClient()` con el `organization_id` explícito
  (`lib/db/resumenes.ts`). Un `select` sobre una tabla sin `organization_id`
  falla fuerte, no filtra mal.
- **Un resumen con `foto_fiable` nunca se pisa** con uno que no lo es
  (regenerar a mano un mes viejo perdería la foto real del cierre).
- Sin cotización real (`getDolarServer().fuente === "fallback"`) el resumen
  guarda `cotizacion: null` y **no arma el patrimonio**: el valor de respaldo
  es inventado y no se congela.
- UI: `/resumenes` (lista + «Generar resumen de un mes», solo admin, Finanzas)
  y `/resumenes/[periodo]` (detalle + `Imprimir / PDF` con `ReciboImprimir`,
  `ReciboPagina.sinCliente`). La pantalla y el PDF se dibujan desde la misma
  `armarSecciones`. Agregar una métrica = sumarla a `ResumenMensual`, a
  `armarSecciones` y subir `RESUMEN_VERSION` si cambia el shape.

### Planes y prueba gratis (plan 015)

Cada organización nueva arranca en **`trial` por 30 días sin tarjeta**
(defaults de las columnas de `organizations`, el signup no pasa nada). Vencida
la prueba, la cuenta pasa a **solo lectura**: se ve todo, no se escribe, y no se
borra nada. Cobro hoy **por transferencia, a mano**: el admin de plataforma
asigna plan/estado/fin de período desde `/admin/organizaciones/<id>`
(`PlanOrgCard`, botón "+30 días"). Cuando haya proveedor de pagos (Mercado
Pago), su webhook escribe esas mismas columnas.

- **Columnas** (`20261011100000_planes_trial.sql`): `plan`
  (`trial | starter | business | business_plus`), `plan_estado`
  (`trial | activo | vencido | cancelado`), `trial_termina_at`,
  `periodo_termina_at`. Las orgs previas al plan quedaron en `business_plus`
  / `activo` sin vencimiento. Solo service role las escribe.
- **Reglas puras** en `lib/planes.ts` (con test): `PLANES` (límites y precios
  de referencia), `estadoDeAcceso` (`ok | trial | solo_lectura`, 7 días de
  gracia sobre `periodo_termina_at`), `puedeEscribir`, `cupoUsuarios`. Límites:
  **Starter 1, Business 3, Business+ 10 usuarios**; la prueba es el plan
  Starter (1 usuario). Gracia: **7 días** (cubre los reintentos de Mercado Pago).
  **Ciclo mensual o anual** (`Ciclo`, `precioCiclo`: el anual cobra
  `MESES_PAGOS_ANUAL` = 10 meses), guardado en `organizations.plan_ciclo`.
- **Gating**: `SessionUser.suscripcion` viene de `getSession`.
  `requireEscritura()` / `requireRoleEscritura(...)` (`lib/auth`) reemplazan a
  `requireUser`/`requireRole` en **toda server action que muta** (redirigen a
  `/plan` si la cuenta está en solo lectura). Una action nueva que escribe usa
  esas; las de solo lectura (`getClienteHistorialAction`, buscador,
  `updateOwnProfile`, `signOut`) siguen con `requireUser`. `inviteMember`
  rechaza si el cupo del plan está lleno (cuenta perfiles activos, invitaciones
  incluidas).
- **UI**: `PlanBanner` (layout `(app)`: últimos 7 días de prueba o solo
  lectura), `/plan` (plan actual, uso, planes; link "Plan y facturación" en
  `UserMenu` para admin). `NEXT_PUBLIC_CONTACTO_EMAIL` (opcional) arma el
  mailto de "escribinos para activar".
- Los montos viven solo en `PLANES` (`lib/planes.ts`): la landing
  (`components/marketing/pricing.tsx`, con selector mensual/anual) y el
  JSON-LD los leen de ahí.
- **Mercado Pago (suscripciones)**: con `MERCADOPAGO_ACCESS_TOKEN`, `/plan`
  muestra «Suscribirme» por plan (`suscribirseAction` → `POST /preapproval`
  sin plan asociado, `status: pending`, `external_reference =
  <orgId>:<plan>:<ciclo>`, `frequency` 1 o 12 meses → redirige al
  `init_point`; durante la prueba `start_date` = fin de la prueba,
  `inicioDelCobro`, así no pierde días). Sin token, queda el aviso de
  transferencia. El webhook `/api/webhooks/mercadopago` (público en el
  middleware) **no confía en el aviso**: toma el id, vuelve a pedir el
  preapproval/authorized_payment a la API y `aplicarPreapproval`
  (`lib/db/suscripciones.ts`) escribe `plan`/`plan_estado`/
  `periodo_termina_at` (= próximo cobro) + `mp_preapproval_id`/`mp_estado`/
  `mp_payer_email`. Cambio de plan: la suscripción vieja se cancela recién
  cuando la nueva queda `authorized`. Cancelar/pausar respeta el período ya
  pago. Para cancelar la API exige `cancelled` (doble L, la doc dice
  `canceled`); `normalizarEstadoMp` acepta las dos. Firma (`MERCADOPAGO_WEBHOOK_SECRET`, `firmaWebhookValida` en
  `lib/mercadopago.ts`, puro con test) se valida y una inválida solo se
  loguea. Suscribirse usa `requireRole` (no `requireRoleEscritura`): una
  cuenta vencida tiene que poder pagar.

## Sistema de diseño

Referencia visual: "Cocos CRM" — limpio, mucho whitespace, esquinas
redondeadas, paleta neutra + un acento **índigo**.

### Marca: logos de Tekly (`public/tekly-logo-kit/`)

Kit de logo de la **plataforma** (v2: una **T índigo `#4f49bd` con un punto
verde `#12a383`** que representa "en vivo"; sobre fondos índigo u oscuros, T
blanca con punto menta `#7fe3c9`; nombre "tekly" en minúscula, Bricolage
Grotesque 700, ya convertido a trazos). El detalle del paquete está en
`public/tekly-logo-kit/LEEME.md`; `public/tekly-logo-kit.zip` es solo el
paquete original (no se referencia desde la app). El verde también es el
color de los indicadores "en vivo" del producto.

**Siempre se usa vía `<TeklyLogo variante="…" altura={px} />`**
(`components/brand/tekly-logo.tsx`): un solo lugar con las rutas y las
proporciones; no hardcodear `/tekly-logo-kit/…` en los componentes. `alt=""`
cuando el link/botón que lo contiene ya tiene `aria-label`.

| Archivo (SVG en `public/tekly-logo-kit/`) | Variante | Dónde va |
|---|---|---|
| `tekly-isologo.svg` | `horizontal` | Header y footer de la landing (`components/marketing/nav.tsx`, `footer.tsx`); drawer móvil del sistema, legales y demo. Solo sobre fondo claro. |
| `tekly-icono-indigo.svg` | `icono` | Marca chica sobre cuadrado índigo: panel de plataforma (`app/admin/layout.tsx`); maqueta borrosa del login. También avatar/redes. |
| `tekly-icono.svg` | `icono-invertido` | Cuadrado blanco con la T índigo: encabezado índigo de las pantallas de auth (`components/auth/auth-modal.tsx`) y header del sistema (`components/topnav.tsx`) cuando la organización no cargó su propio logo (sobre el header blanco el cuadrado desaparece y queda la T con el punto). |
| `tekly-marca.svg` | `marca` | **Sin uso todavía.** La T con el punto sola, sin cuadrado. Hay `tekly-marca-blanca.svg` y `tekly-marca-mono.svg` (sellos/impresión) sin variante. |
| `tekly-isologo-blanco.svg` | `horizontal-blanco` | **Sin uso todavía.** Blanco y menta, fondo transparente, para fondos índigo/oscuros. |
| `tekly-isologo-sobre-indigo.svg` | `horizontal-sobre-indigo` | **Sin uso todavía.** Isologo con el fondo índigo incluido. |
| `tekly-wordmark.svg` | `wordmark` | **Sin uso todavía.** Solo el nombre. |
| `tekly-favicon.svg` | — | Favicon SVG (`icons.icon` en `app/layout.tsx`): la marca más grande dentro del cuadrado. |
| `favicon.ico` (16, 32 y 48 px) | — | Copiado a `public/favicon.ico`; es el favicon de respaldo. |
| `png/tekly-icono-180.png` | — | `apple-touch-icon` (`icons.apple` en `app/layout.tsx`). |
| `png/tekly-icono-512.png` | — | Logo del JSON-LD (`lib/marketing/seo.ts`). |
| `png/tekly-isologo-sobre-indigo.png` | — | Logo de los templates de mail de Auth (`supabase/email-templates/`). |
| `png/tekly-icono-192.png`, `-1024`, `-indigo-512`, `tekly-favicon-16/32/48.png`, `tekly-isologo.png`, `tekly-marca.png` | — | **Sin uso todavía:** 192/512 reservados para un `manifest` PWA (no hay); el resto, PNG de respaldo para redes, mails y documentos. |

El logo de la **plataforma** no es el de cada **negocio**: el header del
sistema muestra primero el logo y el nombre que la organización cargó en
Configuración (`organizations`), con "by tekly" debajo; los recibos/PDF
llevan el membrete del negocio. Tekly aparece ahí solo como fallback (ícono
cuando el negocio no subió logo) y en "by tekly".

### Color

| Token | Valor | Uso |
|---|---|---|
| `accent` | `#4f49bd` (índigo) | marca + interacción (links activos, botón primario, foco, avatar) — **toda la app** |
| `accent-soft` | `#edecf8` | fondo de estado activo / hover suave |
| `neutral-50` | fondo de la app (`body`) |
| `neutral-200` | bordes de card / divisores |
| `neutral-400` | labels, captions, texto placeholder |
| `neutral-500/600` | texto secundario |
| `neutral-900` | texto principal |
| emerald / red | positivo / negativo (deltas, ingresos/egresos) |

#### Paleta de gráficos (`lib/chart.ts`) — monocromática índigo

Un solo hue, de oscuro a claro; **mayor valor = tono más oscuro**. Vale para
todo gráfico de la app (dashboard, analíticas, …).

| Constante | Valor | Uso |
|---|---|---|
| `CHART_COLORS` | 5 pasos `#2e2a5f → #948dde` | categorías (dona, barras apiladas, pipeline). Ordenadas |
| `chartColor(i)` | — | cicla `CHART_COLORS` |
| `CHART_ACCENT` | `#4f49bd` | líneas y rellenos con presencia (= `accent`) |
| `HEAT_SCALE` | 6 pasos `#e9e8f9 → #2e2a5f` | rampa de heatmaps (claro→oscuro) |
| `CHART_TRACK` | `#e9e8f9` | pista de arcos / fondo "fantasma" |
| `GHOST_STRIPES` | rayado gris 45° | barra en reposo / tramo no cumplido |

`heatCell(v, min, max, scale?)` toma la escala como 4º arg opcional (default
`HEAT_SCALE`). `DASH_COLORS` / `dashColor` / `DASH_ACCENT` / `DASH_HEAT` son
**aliases** de las de arriba (se estrenaron en el dashboard; ya son globales).

**Estados y etiquetas:** nunca hardcodear colores de estado. Usar el map de
`lib/status.ts` (`ticketStatus`, `celularStatus`, `repuestoEstado`,
`turnoStatus`, `turnoTipo`, `medioPago`, `otroCategoria`) — todos devuelven
`{ label, tone }`, `tone ∈ blue | amber | green | gray | red | violet`, con su
color asociado ya resuelto en `dotClass`.

En **listas/tablas** (columna de estado, medio de pago, categoría, tipo) el
patrón es un chip gris neutro (`bg-neutral-100 text-neutral-700 rounded-md
px-2 py-0.5 text-xs`) con un punto `dotClass[tone]` (`h-1.5 w-1.5 rounded-full`)
al lado del label — el color vive en el punto, no en el fondo del chip. Ya lo
usan Ventas (Pago), Reparaciones (Estado), Inventario (Estado de
celulares/notebooks, repuestos, Categoría de "Otros") y Turnos (tipo/estado). Para una
etiqueta nueva en una columna de tabla, replicar este patrón en vez de
`Badge`.

El componente `Badge` (`components/ui/badge.tsx`: fondo de color + `tone`,
forma cuadrada `rounded-md`, `text-xs`, sin variante pill) sigue siendo válido
para usos puntuales fuera de tablas — un badge suelto en un diálogo de
detalle, el buscador de ítems de Nueva venta — pero ya no es el default
para columnas de tabla.

### Tipografía (escala en uso)

| Clase | px | Uso |
|---|---|---|
| `text-3xl` | 30 | valor grande de `StatCard`, número hero de un gráfico |
| `text-lg` | 18 | contadores medianos / encabezados grandes de card (el `Topbar` ya **no** tiene h1) |
| `text-sm` | 14 | body, celdas de tabla, cuerpo de card |
| `text-[13px]` | 13 | texto secundario denso (listas, filas compactas) |
| `text-xs` | 12 | `ChartTitle`, `Badge` |
| `text-[11px]` | 11 | labels/eyebrows (incl. label de `StatCard`), micro: `Delta`, leyendas ("vs mes previo", "del objetivo") |

Pesos: `font-semibold` para valores y títulos; `font-medium` para labels.
Números (montos, contadores, IMEI): **siempre `tabular-nums`**.

**Fuente del texto: Sora** (toda la app y la landing: cuerpo, tablas, botones,
formularios, recibos). Variable font cargada con `next/font` en
`app/layout.tsx` (`--font-sora`), aplicada al `body` en `app/globals.css` y a
la utilidad `font-sans` de `tailwind.config.ts`. Soporta `tabular-nums` (los
dígitos miden todos lo mismo), así que las columnas de montos siguen
alineadas. Es más ancha que `system-ui`: al agregar columnas/botones densos
revisar que no desborden. Las únicas otras fuentes: Bricolage Grotesque
(`font-display`, solo titulares de la landing) y `font-mono` para IMEI/series.

**Números hero** (valor de `StatCard` / `MetricCards`, número grande de un
gráfico): fuente **Space Grotesk** vía la utilidad `font-grotesk` (cargada con
`next/font` en `app/layout.tsx`, variable `--font-space-grotesk`). `StatCard` ya la aplica → una fila de KPIs con `StatCard`
sale sola. El `MetricCards` del dashboard (card compacta propia) también.

**Labels y eyebrows en MAYÚSCULA**: el `Label` de `components/ui/field.tsx` ya
sale `text-[11px] font-semibold uppercase tracking-wider`. Para separadores de
sección dentro de un form/dialog usar el mismo estilo (ej. `Eyebrow` en el
modal de Nueva venta). Va en línea con `ChartTitle` y los headers de tabla.

### Espaciado, radios, layout

- Card: `p-4` (stats / compacto) · `p-5` (gráficos y paneles).
- Grillas: `gap-4` para filas de stats · `gap-6` para bloques de sección.
- Contenedor de sección: `space-y-5` o `space-y-6`. `<main>` (`Section`,
  `components/section.tsx`) usa `p-4 md:p-8` por defecto — compacto en mobile,
  el `p-8` fijo dejaba mucho aire a los costados en pantallas chicas; una
  página puede pasar su propio `mainClassName` (el Dashboard fija alto de
  ventana + padding propio).
- Navegación: **no hay sidebar fijo** (`components/sidebar.tsx` existe pero
  no se usa en ningún layout — no reintroducirlo sin borrar antes el que ya
  no anda). La nav real es `TopNav` (`components/topnav.tsx`): header
  `sticky top-0 h-16`, categorías como pills redondeadas con dropdown para
  las que agrupan varias secciones; debajo de `md` colapsa a
  `MobileNavDrawer` (drawer lateral animado, `components/mobile-nav-drawer.tsx`)
  detrás de un botón hamburguesa. El contenido de página nunca necesita
  padding-left para una sidebar — ya no existe.
- Radios: card `rounded-2xl` · inputs/botones/tabs `rounded-lg` ·
  chips/barras `rounded-md` · badges/avatares `rounded-full` ·
  icon tiles `rounded-xl`.

### Breakpoints (uso real, no aspiracional)

Sin diseño mobile-first: la app está pensada para desktop, pero las
secciones más densas (Ventas, Inventario, Reparaciones, Cajas, Compras) sí
adaptan grillas/columnas con `sm:`/`lg:`. Dos quiebres hacen el trabajo
pesado y son los únicos con significado fijo en toda la app — reusarlos así,
no inventar otros para el mismo propósito:

- **`md` (768px)** — quiebre de navegación: por debajo, `TopNav` colapsa a
  `MobileNavDrawer`; por encima, aparece la barra de categorías. También el
  quiebre genérico de "una columna en mobile, grilla en desktop" para
  formularios/paneles densos.
- **`xl` (1280px)** — solo texto: entre `md` y `xl` la nav muestra únicamente
  íconos (ahorra espacio horizontal); a partir de `xl` aparece el label de
  cada categoría al lado.

### Motion

Las únicas animaciones con nombre de la app viven en `tailwind.config.ts`
(`keyframes`/`animation`) — reusar estas, no declarar un `@keyframes` nuevo
para el mismo tipo de transición:

| Animación | Duración / easing | Uso |
|---|---|---|
| `animate-fade-in` | 180ms `ease-out` | aparición genérica (dropdowns, overlays, contenido que entra) |
| `animate-toast-in` / `animate-toast-out` | 220ms / 180ms, `cubic-bezier(0.21,1.02,0.73,1)` / `ease-in` | entrada/salida de un toast (`Toaster`) |
| `animate-drawer-in` | 220ms, mismo cubic-bezier que el toast | `MobileNavDrawer` deslizando desde la izquierda |
| `animate-celebrate-in` / `animate-celebrate-check` | 250ms `ease-out` / 500ms `cubic-bezier(0.34,1.56,0.64,1)` | confirmaciones con overshoot (ej. check animado) |

Fuera de esas, las transiciones son utilidades de Tailwind sueltas
(`transition-colors`, `transition-all duration-150` en `Button`) — 150ms es
el estándar para hover/active de botones y links; no bajar de 120ms ni subir
de ~300ms para nada que responda a una interacción directa del usuario. No
hay manejo de `prefers-reduced-motion` todavía en ningún componente — pendiente,
no asumir que ya se respeta.

### Forbidden defaults (específico de esta app)

Además de lo genérico (`lorem ipsum`, hero centrado con blob de gradiente):
**sin dark mode** (`color-scheme: light` fijo en
`globals.css` — no agregar `dark:` sueltos sin decidir soportarlo de
verdad), **un solo hue en gráficos** (paleta monocromática índigo de
`lib/chart.ts` — nunca colores arbitrarios por serie, ver "Paleta de
gráficos"), **sin gradientes en botones** (el `Button` primario va en
`accent` plano + sombra, ver `components/ui/button.tsx`) y el header violeta
de `AuthModal`/recibos es el único degradé que queda — no crear un gradiente
para otro botón o card, **`Badge` es siempre `rounded-md`** (nunca pill —
`shape` no existe como prop suya, a diferencia del `IconButton`), y **nunca**
`toLocaleString("en-US")`/`"USD "` a mano para moneda (ver "Moneda").

### Errores de UI/accesibilidad que ya nos mordieron — no repetirlos

Un audit (`/ux-ui-audit`, ver `AUDIT.md`) encontró estos cuatro patrones
repetidos en varias secciones. Ya se corrigieron las instancias existentes;
la regla es para no reintroducirlos en código nuevo:

- **`text-neutral-400` no es apto para texto de UI sobre blanco/`neutral-50`**
  — mide ~2.5:1, WCAG AA pide 4.5:1 para texto normal. Es el error más común
  porque *parece* el tono correcto para un label secundario. Labels,
  eyebrows (`ChartTitle`, `Field`/`Label`) y captions van en
  **`text-neutral-500`** (4.74:1, pasa AA) como mínimo — `neutral-400` queda
  reservado para bordes, íconos decorativos o placeholders de input (que
  WCAG no exige a 4.5:1). Antes de usar `neutral-400` en un texto nuevo,
  preguntarse si es realmente decorativo/no-informativo.
- **Todo control solo-ícono (botón o `<select>` de toolbar sin `<label>`
  visible) necesita `aria-label`.** El botón de categoría de `TopNav`
  (ícono sin texto entre `md` y `xl`), la campana de notificaciones y los
  `<Select>` sueltos de filtro (vendedor/tipo/fecha/técnico/estado en
  Ventas/Reparaciones/Dashboard) se enviaron así por meses sin que nadie lo
  notara visualmente — un lector de pantalla no tiene forma de saber qué
  hace el control. Regla simple: si el control no tiene texto visible propio
  (solo ícono, o un `<select>` sin `Field`/`Label` al lado), lleva
  `aria-label` describiendo la acción/filtro.
- **El patrón de `key={condición ? id : "fallback"}` para resetear un
  `Dialog` al reabrir (ver "`Dialog`: todos los de una sección…") necesita un
  `fallback` distinto por cada dialog del componente**, nunca el mismo
  literal (`"none"`) compartido — cuando dos o más dialogs hermanos están
  cerrados a la vez (el estado inicial más común), React tira `Encountered
  two children with the same key` si comparten el fallback. Prefijar con el
  nombre del dialog (`"recibo-none"`, `"entregar-none"`, `"equipo-none"`).
- **Un valor que depende de un fetch client-only (ej. la cotización en vivo
  de `useDolar()`) no puede usarse para recalcular un dato ya persistido en
  el primer render** — el server no tiene esa cotización en vivo, el cliente
  sí, y el mismatch entre ambos passes tira `Text content did not match`
  (hydration error) apenas carga la página, con el monto en pesos de un pago
  ya guardado cambiando solo frente al usuario. Un monto que ya se guardó
  (ej. el ARS de un pago viejo) se muestra con el dato guardado, no
  recalculado contra la cotización de hoy — recalcular con la cotización
  vigente es correcto solo para operaciones nuevas, todavía no persistidas.
- **(Landing) Los blobs de fondo (`AmbientBlobs`, wrapper `-z-10`) quedan
  invisibles si la sección que los contiene no crea su propio stacking
  context** — el `-z-10` pinta en el paso 2 del contexto raíz y el
  `bg-neutral-50` del layout de marketing (div ancestre, opaco) pinta después
  (paso 3) encima: los blobs del hero y del banner de cierre pasaron meses
  enterrados sin que nadie lo notara. Toda sección/contenedor con
  `AmbientBlobs` lleva `isolate` (hero y banner del cierre ya lo tienen).
- **(Landing) No centrar un blob con `left-1/2 -translate-x-1/2` si
  framer-motion anima `x`/`y` en el mismo div** — el `transform` inline que
  escribe framer pisa el translate de la clase de Tailwind y el elemento
  queda corrido (el blob superior del hero renderizaba ~340px descentrado).
  Centrar con margen negativo (`left-1/2 -ml-[mitad-del-ancho]`), que framer
  no toca.

### Moneda

- `fmtUsd(n)` → **`"U$ 48.250"`** (prefijo `U$`, miles con `.`, sin decimales,
  locale es-AR). Es el formato único para dólares en toda la app.
- `fmtArs(n)` → pesos con `Intl` (`$ …`). El "dólar blue" va en `$` porque es
  un monto en pesos.
- No volver a usar `toLocaleString("en-US")` ni `"USD "` a mano.

### Reglas globales de tablas (`app/globals.css`, sin capa → ganan sobre Tailwind)

Aplica a **toda tabla, presente y futura** (menos los recibos/PDF):

- **Encabezado (`th`)**: banda **índigo oscuro** (`#352f86`), texto **blanco,
  negrita, MAYÚSCULA**. No hace falta poner clases de estilo en los `th`
  (igual conviene el `<tr>` del thead con `text-xs`).
- **Separadores**: línea vertical fina blanca (30 %) a media altura entre
  encabezados (`th + th::before`), salvo antes de una columna vacía
  (acciones). Global, no hace falta clase.
- **Filas cebra**: `tr` par en índigo muy claro (`#f0eff9`), impar blanca.
  Regla en `@layer base` para que el `hover:bg-*` de cada fila siga ganando.
  Los `.recibo-print` tienen su propia cebra, en violeta claro (`#edecf8`,
  `accent-soft`) en vez del índigo muy claro del resto de la app.
- **Todo centrado, en todas las tablas del sistema, sin excepciones**
  (decisión del usuario, 25/11 — reemplaza al plan 007 y al opt-out de texto
  largo): headers y celdas, nombres/detalles/descripciones incluidos. El
  global (`th, td { text-align:center }`) ya no tiene opt-out: `text-start`/
  `text-right` en un `th`/`td` **no** alinea fuera de `.recibo-print`. Una
  celda con contenido `flex` (ícono + texto, chevron de árbol) lleva
  `justify-center`; mejor `inline-flex`, que se centra solo.
- Números en columnas → `tabular-nums`. Texto de las celdas: peso normal (dejar
  `font-semibold` solo para el dato que tiene que destacar, ej. Total).
- Fuera de tablas, alinear a la izquierda con `text-start`.
- Los encabezados ordenables (`ThSort`) llevan `uppercase` en su `<button>`:
  un botón no hereda el `text-transform` del `th`. Los recibos/PDF
  (`.recibo-print`) conservan su propio criterio por columna.

## Componentes reutilizables — usar SIEMPRE estos

### `StatCard` — `components/ui/stat-card.tsx`

Tarjeta de métrica estilo Dashboard. **Toda fila de KPIs de cualquier sección
usa esto**, no rehacer cards de stats a mano.

```tsx
<StatCard label="Facturado" value={fmtUsd(total)} />
<StatCard label="Ventas del mes" value="U$ 48.250" delta={12.4} />          // delta => variación %
<StatCard label="Cotización" value="$ 1.465" delta={0.7} deltaHint="hoy" />
<StatCard label="Egresos hoy" value={fmtUsd(x)} valueClassName="text-red-500" />
<StatCard label="Stock" value={12} hint="unidades" align="left" />
```

Props: `label`, `value` (ReactNode), `delta?`, `deltaHint?` (default
`"vs mes previo"`), `hint?` (nota cuando no hay delta), `align?`
(`"center"` default | `"left"`), `valueClassName?`, `className?`,
`onClick?` + `active?` (card clickeable como filtro, ej. el pipeline de
Reparaciones). `Delta` se exporta aparte por si hace falta suelto.

El `value` sale en **`font-grotesk`** (Space Grotesk) — es la fuente de todo
número hero de la app (ver Tipografía). No hace falta pasarlo a mano.

### `ChartTitle` — `components/ui/chart-title.tsx`

Título de gráfico / encabezado de card: **siempre en mayúscula**. Centrado por
defecto; `align="left"` para alinear a la izquierda. `sub` = línea de contexto
abajo. `divider` = línea fina abajo (`border-b border-neutral-100 pb-3 mb-3`) —
el patrón "título + subtítulo + línea" del dashboard. **Todo encabezado de card
que ya tenía un título usa `<ChartTitle align="left" divider>`.**

```tsx
<ChartTitle align="left" divider>Resumen del mes</ChartTitle>
<ChartTitle align="left" divider sub={`${n} tickets`}>Reparaciones mes</ChartTitle>
```

### Gráficos — reglas

Valen para **todo gráfico de la app** (dashboard, analíticas, clientes, …).
Método: `dataviz` skill.

**Header** — siempre `<ChartTitle align="left" divider sub="…">` (título +
subtítulo + línea fina antes del cuerpo). Nada de subtítulos sueltos abajo de
la línea. En los widgets del dashboard la línea puede estar en el contenedor del
cuerpo (`border-t border-neutral-100 pt-3`) — mismo resultado.

**Tipografía / color de texto**
- Número hero del gráfico → `font-grotesk` (ver Tipografía). Labels y ejes →
  `text-neutral-400`, captions en `text-[10px]/[11px]`. Dígitos → `tabular-nums`.
- El texto **nunca** lleva el color de la serie: valores/labels/leyenda van en
  tinta (`neutral-*`); el color lo lleva solo el cuadradito/línea al lado.
- Verde/rojo = **colores de estado** (componente `Delta`). Reservados: no se
  usan como color de serie.

**Marcas**
- Líneas: `strokeWidth 2`, `strokeLinecap/Linejoin round`. Área bajo la línea:
  gradiente del color a `opacity 0`.
- Marcadores de la línea: círculo ≥ 8px, `bg-white` + borde 2px del color.
- Barras verticales: `rounded-t-xl`, ancladas a la base; la más alta llena la
  banda (`SCALE = 100`).
- Barras horizontales — dos variantes, no mezclar:
  - **Objetivo / cuota** (un valor vs. una meta o un mínimo — ej.
    `ObjetivoPanel`, el split de `ReparacionesSplit`, las barras de stock de
    Inventario): pista = `GHOST_STRIPES` (importado de `lib/chart.ts`, **nunca
    reimplementado** con un `repeating-linear-gradient` a mano), `rounded-full`,
    relleno sólido — `CHART_ACCENT` para una métrica genérica, o un color de
    estado (verde/ámbar/rojo) cuando la barra representa una urgencia (ej.
    stock bajo/agotado — ese uso de color semántico está bien, no es color de
    serie).
  - **Ranking / comparación** (varias barras, cada una independiente contra su
    propio máximo — ej. `BarRows` de Analíticas, `RepairsChart`,
    `demografia.tsx`): pista lisa `bg-neutral-100` (sin rayas — no hay "meta"
    que marcar), relleno `CHART_ACCENT` (o `chartColor(i)` si las barras son
    categorías con series propias). Alto/forma (`rounded-full` fino en listas,
    `rounded-md` más grueso en charts) según la densidad, pero siempre pista
    lisa + relleno único.
- Promedio → línea `border-dashed border-neutral-400` con pill `Avg`.

**Dona** (`components/dashboard/donut-chart.tsx`): anillo grueso, **separadores
blancos radiales** (líneas de `stroke="#fff"` de borde interno a externo) — nunca
gaps de `strokeDasharray` (quedan inclinados). `%` de cada segmento en chip
`rgba(255,255,255,.25)` + texto blanco. Leyenda debajo.

**Heatmap** (Turnos): números **siempre `text-white`**; celda coloreada por
`heatCell(count, 0, max)` (usa `HEAT_SCALE` índigo). Columnas de ancho fijo
para que queden pegadas. En el widget del dashboard las filas se estiran
para ocupar todo el alto de la card (sin `aspect-square`: la lista
"Próximos" de al lado es más alta que 3 filas cuadradas y dejaba un hueco
abajo); en Analíticas (`HeatmapActividad`) las celdas siguen cuadradas.

**Tooltip de hover** (Tendencia, Turnos): caja `bg-neutral-900` texto blanco,
`rounded-lg`, `shadow-lg`, `pointer-events-none`. Título centrado; cada fila
`label` a la izquierda y valor a la derecha (`ml-auto`). Se ancla al **borde** de
la barra/celda + gap, y salta al otro lado cerca del borde derecho.

**Leyenda**: obligatoria si hay ≥ 2 series. Con ≤ 4 series, además etiqueta
directa (ej. el `%` dentro del segmento de la dona) — identidad nunca solo por
color.

### Layout estándar de sección con tabla

Toda sección con tabla (Ventas, Compras, Reparaciones, Inventario, Cajas,
Clientes, Cuentas corrientes, Recuentos) arma su página con `SeccionTabla`
(plan 009). Orden fijo, siempre el mismo:

1. **Barra de visibilidad** — dos botones "Gráficos" / "Tarjetas"
   (Eye/EyeOff, `aria-pressed`, `aria-controls`), alineados a la derecha. La
   provee `SeccionTabla`; no armar toggles propios.
2. **Gráficos** — 2 cards lado a lado (`xl:grid-cols-2`), **alto fijo `h-72`**
   desde `sm`. Cada uno va dentro de `GraficoCard` (o de un wrapper de
   `components/seccion/graficos.tsx`); ninguno define su propia altura.
3. **Tarjetas** — 4 `StatCard` por defecto (`grid-cols-2 gap-3
   lg:grid-cols-4`), con `hint` o `delta` para que midan igual. Excepciones
   confirmadas: Reparaciones (8 del pipeline) y Cajas · Movimientos (5 por
   medio de pago) conservan su cantidad porque filtran la tabla —
   `columnasTarjetas={8}` / `columnasTarjetas={5}`.
4. **Filtros** — `BarraFiltros`, siempre dentro de un **panel con borde**
   (blanco, `rounded-2xl`, `border-neutral-200`, `shadow-sm`: el mismo
   lenguaje que la `Card` de la tabla, para que no queden «flotando» sobre
   el fondo). **Con tabs** (de *entidad* —Celulares/Notebooks/Repuestos— o
   de *vista* —Ventas/Ítems vendidos—) son **dos filas**: arriba los tabs con
   la acción primaria a la derecha; línea divisoria (`border-t`) y abajo,
   sobre `bg-neutral-50/70`, buscador → selects. **Sin tabs**, una sola fila
   (buscador → selects → acción). Los chips de filtros activos van debajo,
   fuera del panel. En mobile solo los selects se colapsan detrás de
   "Filtros · N". **Regla: toda fila de filtros/selector de categoría usa
   `BarraFiltros`** — no armar la fila a mano (Ventas la tenía a mano y se
   pasó) ni meter los tabs de categoría en la misma fila que los filtros.
5. **Tabla** (con `Pagination` si es server-paginada).

Los tabs (Inventario Celulares/Notebooks/Repuestos/Otros, Cajas
Movimientos/Conciliaciones/Cajas, Recuentos Recuentos/Movimientos, Ventas
Ventas/Ítems vendidos, Reparaciones Tickets/Servicios) van todos en el panel
de `BarraFiltros` (fila de arriba, con los filtros en la fila de abajo) — no
arriba de los gráficos.

Gráficos y tarjetas son **dos bloques independientes**: cada uno se oculta con
su propio botón (persistido por sección en `localStorage`, `tekly:ui:<id>`) y
la tabla sube al desmontarse. Los gráficos respetan los filtros de la sección;
los de una sección server-paginada (Ventas) se calculan en el server sobre el
período completo (`resumenVentas`/`graficosVentas`), nunca con la página
visible.

### Botones (plan 010)

**Un solo sistema de botones** en `components/ui/button.tsx`: la landing y
la app usan el **mismo código de estilos** (la landing cambia solo el tamaño
vía el envoltorio `MarketingButton`). Nada de `<button>`/`<Link>` con clases
de botón escritas a mano — un test guarda (`lib/botones.guard.test.ts`)
falla si aparece uno.

- **`Button`** — `variant: primary · outline · tonal · ghost · danger ·
  danger-outline · link · inverse`; `size: sm` (32px) · `md` (36px, default
  de la app) · `lg` (40px) · `xl` (48px, hero/CTA de la landing); `chip`
  (círculo con `ArrowRight` que se desliza al hover; **solo la landing** —
  el login/signup y el resto de la app van sin flecha); `icon` (lucide: en
  `primary`/`outline`/`tonal`/`danger`/`danger-outline`/`inverse` va dentro
  de un **círculo a la derecha**, del mismo tamaño que el chip de flecha,
  con una animación mínima al hover — el "+" gira 90°, los demás crecen un
  poco; en `ghost`/`link` queda suelto a la izquierda). El ícono se pasa
  siempre con la prop `icon`, **no** como hijo; `loading` (spinner
  `Loader2`, deshabilita y mantiene el ancho); `fullOnMobile` (`w-full
  sm:w-auto`, footers). Pill, `font-semibold` **sin mayúsculas**. `inverse`
  es solo para la landing (CTA blanco sobre fondo accent).
- **`IconButton`** — solo ícono; `aria-label` es **obligatorio** (el tipo lo
  exige); `variant: ghost · outline · danger-ghost`; `size: sm · md · lg`;
  `shape: round · square`.
- **`ButtonLink`** — misma apariencia, renderiza `next/link`. Para links de
  **navegación** con look de botón (ej. "Ver inventario"). Un link de texto
  dentro de un párrafo no es botón.
- `MarketingButton` (`components/marketing/ui/marketing-button.tsx`) es un
  envoltorio de `buttonClasses()` para el `<a>` de la landing (apunta a otro
  origen). **Su aspecto no debe cambiar.**
- Variante por caso: `primary` = acción principal de un form/alta; `tonal` =
  acción de toolbar/acción extra de dialog; `outline` = Cancelar/Cerrar/
  filtros; `ghost` = toggles/texto; `danger`/`danger-outline` = destructivo
  (borrar); `link` = link de texto.
- **Controles vecinos** (`Tabs`, `filterPill`, los botones de página de
  `Pagination`, `BotonBloque` de `SeccionTabla`): misma altura (36px), radio
  pill, borde `border-neutral-900/10` y foco que `outline` md, para que una
  fila de filtros se vea pareja — **sin** convertirlos en `Button`.
- Galería de QA en dev: `/qa` (pública solo fuera de producción vía
  `middleware.ts`; `notFound()` en prod).

### Otros primitivos

| Componente | Archivo | Notas |
|---|---|---|
| `Section` | `components/section.tsx` | `{ title, children, mainClassName?, toolbar? }` — wrapper de toda página. El `Topbar` **ya no muestra `title`** (se mantiene por compat); `toolbar` = control opcional en la Topbar (ej. selector de período del dashboard). **Sin `actions`** |
| `Card` | `components/ui/card.tsx` | contenedor base (`rounded-2xl border shadow-sm`) |
| `Button` | `components/ui/button.tsx` | sistema único de botones (plan 010) — ver sección "Botones". Resumen: `variant: primary \| outline \| tonal \| ghost \| danger \| danger-outline \| link \| inverse`; `size: sm \| md \| lg \| xl` (`md` por defecto); `chip` (flecha), `icon`, `loading`, `fullOnMobile`. Renderiza un `<button>` |
| `IconButton` | `components/ui/button.tsx` | solo ícono: `{ aria-label (obligatorio), icon, variant: ghost \| outline \| danger-ghost, size: sm \| md \| lg, shape: round \| square }` |
| `ButtonLink` | `components/ui/button.tsx` | misma apariencia que `Button` pero `next/link`. `MarketingButton` es un envoltorio suyo |
| `Badge` | `components/ui/badge.tsx` | `{ tone, dot?, className? }` — forma ÚNICA cuadrada (`rounded-md`); no hay prop de forma. Colores por `lib/status.ts` |
| `Dialog` | `components/ui/dialog.tsx` | `{ open, onClose, title, description?, footer?, size: md \| lg \| xl \| 2xl \| 3xl \| 4xl, formulario? }` (anchos `max-w-md/2xl/3xl/4xl/5xl/6xl`; `formulario` = modo formulario: body centrado salvo el contenido de las casillas, ver "`Dialog`: …" abajo; **modal que se acerca a 100vh → ensancharlo y partirlo en columnas en `lg:`**, no alargarlo: Nuevo ticket, Entregar equipo, Nueva venta (`4xl`, 2 columnas), canje, Nueva compra, alta de equipo/repuesto/producto en `3xl`; detalles en `2xl`; `ChecklistEditor` acepta `gridClassName`) — **vidrio único** (plan 011): header oscuro `table-header` con texto blanco, panel traslúcido (`bg-white/80`; `xl`/`2xl` → `bg-white/90`), `border-accent/70`, overlay `bg-neutral-900/[0.07] backdrop-blur-[2px]` (anidado: sin segundo blur). Centrado vertical, scroll propio, `createPortal` a `<body>`, cierra con Esc (solo el de arriba si hay dialogs anidados: pila `pilaDialogs`) / click fuera, `role="dialog" aria-modal`. Los campos dentro del body se re-estilan a 42px/radio 14px/blanco 70% con borde gris fino `neutral-300` (para que la casilla se distinga del vidrio). Para resetear el estado interno al reabrir: `key={abierto ? "a" : "b"}` en el uso |
| `Tabs` | `components/ui/tabs.tsx` | `{ value, onChange, options: [{ value, label, count? }], accent? }` — `accent` (hex) para teñir el estado activo con otro color; por defecto usa `accent` |
| `Pagination` | `components/ui/pagination.tsx` | `{ page, total, pageSize?, onPageChange, className? }` — "Mostrando 1–50 de N" + números de página (‹ Anterior · 1 2 3 … N · Siguiente ›), se oculta con una sola página. `paginasVisibles` (helper puro, con test) en `lib/pagination.ts`; `PAGE_SIZE = 50` |
| `SeccionTabla` | `components/ui/seccion-tabla.tsx` | Layout estándar de una sección con tabla (ver "Layout estándar de sección con tabla"): fija el orden tabs → visibilidad → gráficos → tarjetas → filtros → tabla. `{ id, tabs?, graficos?, tarjetas?, columnasTarjetas? (4\|5\|8), filtros?, children }` |
| `GraficoCard` | `components/ui/grafico-card.tsx` | Contenedor de un gráfico de sección: `Card` con alto fijo `h-72` desde `sm`, encabezado `ChartTitle align="left" divider` y cuerpo `flex-1`. **Todo gráfico de una sección con tabla va adentro** — ninguno define su propia altura. `{ title, sub?, action?, children }` |
| `BarraFiltros` | `components/ui/barra-filtros.tsx` | Panel con borde de filtros estándar: con `tabs`, fila 1 = tabs + acción (`ml-auto`) y fila 2 (divisoria, fondo gris suave) = buscador → selects; sin `tabs`, una fila. Chips debajo del panel, colapso mobile "Filtros · N". `{ tabs?, busqueda?, filtros?, chips?, accion?, contadorFiltros? }` |
| `useVisibilidadBloques` | `components/ui/use-visibilidad-bloques.ts` | Hook `{ graficos, tarjetas, toggle }` que persiste la visibilidad de los bloques en `localStorage` (`tekly:ui:<id>`). Lógica pura testeable en `lib/visibilidad-bloques.ts`; visible en SSR/primer render para no romper la hidratación |
| Gráficos genéricos | `components/seccion/graficos.tsx` | `GraficoBarrasVerticales`, `GraficoRanking` (con `suffix`), `GraficoDona` y `GraficoBarrasAgrupadas` — cada uno ya envuelto en `GraficoCard` y con empty state. Reusar antes de crear un gráfico nuevo |
| `Field` / `Input` / `Select` / `Textarea` / `Label` | `components/ui/field.tsx` | inputs con estilo consistente; `Field` = `Label` + control |
| `ClientePicker` | `components/ui/cliente-picker.tsx` | `{ clientes: ClienteOpcion[], value: ClienteSeleccion \| null, onChange, allowLibre?, placeholder?, className? }` — desplegable con buscador para elegir cliente. **Usar SIEMPRE este en vez de un `<Select>`/`Input` a mano** en cualquier form que necesite un cliente (Ventas, Reparaciones, Cuentas corrientes, Turnos son los 4 casos hoy). `ClienteSeleccion` (`lib/types.ts`) = `{tipo:"existente",id,nombre} \| {tipo:"nuevo",nombre,telefono?,email?,fechaNacimiento?} \| {tipo:"libre",nombre}` (+ `instagram?`). «Crear cliente nuevo» abre un **`Dialog` encima** del formulario que usa el picker, con `CamposCliente` (`components/clientes/campos-cliente.tsx`) — el mismo set de campos que «Nuevo cliente» de la sección Clientes (nombre, teléfono, email, Instagram, nacimiento); validación pura `validarBorradorCliente`/`datosDeBorrador` en `lib/clientes.ts`, con test. `clientes.instagram` usa `normalizarInstagram` (CHECK espejo en la base). «Editar datos» reabre el borrador. La creación queda **diferida**: elegir "Crear cliente nuevo" solo arma el borrador, recién se persiste (`resolveCliente` en `lib/db/clientes.ts`) cuando la action del formulario confirma — cancelar el diálogo no deja un cliente fantasma. `allowLibre` agrega "usar sin registrar" (`tipo:"libre"`, sin fila en `clientes`) — solo Turnos lo usa (`Turno.clienteId` es nullable a propósito, para turnos de gente que aún no es cliente registrado); las acciones que sí requieren un cliente real (`createVentaAction`/`createTicketAction`/`createMovimientoCCAction`) tipan su input como `Exclude<ClienteSeleccion, {tipo:"libre"}>` y llaman `resolveCliente`. Comparte `useOutsideClick` (`components/ui/use-outside-click.ts`) con el buscador de ítems de Nueva venta (`ItemBuscador`, en `ventas-client.tsx`, que sigue siendo su propio combobox porque busca sobre equipos/repuestos/otros/servicios, no clientes; el plan 007 le agregó flechas/Enter/Esc y devolver el foco al buscador tras agregar). |

### Estados de elementos interactivos

`Button` es el único primitivo con los 4 estados completos: `hover`/`active`
por variante, `focus-visible:ring-2 ring-accent/40` (global, no lo pisa un
`className` custom sin querer) y `disabled:opacity-50 pointer-events-none`.
`Input`/`Select`/`Textarea` (`lib/field.tsx`) tienen `focus:border-accent` y
`disabled:bg-neutral-50 disabled:text-neutral-400`, pero **sin** estado de
error propio (ningún borde/texto rojo de validación) — replicar ese mismo
patrón (`border-accent` en foco) si se agrega uno, no inventar un tercer
estilo de borde. **Loading — regla (26/11): todo botón que dispara algo que
tarda (server action, guardar/crear/borrar, importar, navegar a otra
sección con `router.push`) lleva `loading` en el `Button`** (`loading={pending}`
con el `pending` de `useTransition`/`useFormStatus`): muestra el spinner
(`Loader2`) y deshabilita el botón mientras dura, y conviene cambiar el texto
(«Guardando…», «Abriendo la venta…»). Nunca solo el texto sin spinner, ni un
spinner propio. Para una navegación lenta: `startTransition(() =>
router.push(...))` y el `isPending` de esa transición va a `loading` (ver
«Pasar a la venta» en `components/ventas/carrito-venta.tsx`). Además está el
loading de ruta (`app/(app)/loading.tsx`, mismo `Loader2`). **Empty states** son ad hoc por tabla (fila con celda
`text-center`, texto tipo "Sin resultados") — no hay componente
`EmptyState` compartido todavía.

### `Dialog`: footer con el sistema único de botones

El footer de **todos** los dialogs usa el mismo primitivo `Button`:
`variant="outline"` para «Cancelar»/«Cerrar» y `variant="primary"` para la
acción principal (`danger`/`danger-outline` para destructivos, `tonal` para
acciones extra en secciones que no tienen acción primaria). `fullOnMobile`
para que en mobile ocupe el ancho. El header es siempre el oscuro del vidrio
(ya no hay `accent`/blanco, plan 011).

**Modo formulario (plan 021).** Todo dialog de **formulario** (alta/edición
de campos, no de solo vista) pasa la prop `formulario` al `Dialog`. Con
`formulario` el body queda **centrado entero menos el contenido de las
casillas**: los labels de `Field`, eyebrows/títulos de sección, textos de
ayuda, avisos y checkboxes (casilla + texto como bloque) se centran; lo que
se escribe/elige dentro de un `Input`/`Select`/`Textarea` va a la izquierda
(la prop aplica `text-center` al body + `text-start` a los inputs/selects y
`text-align-last: start` a los `select`). Los dialogs de **solo vista/detalle**
(`VentaDetalle`, ficha de cliente, detalle de ticket/compra, `ConfirmDialog`,
`ConfirmarAltaDialog`, los modales de recuento) **no** llevan `formulario` y
mantienen su patrón. El modo edición de Inventario (celular/notebook cargado)
tampoco: contiene el historial de movimientos. Para un input que **tiene** que
conservar su alineación (números alineados a la derecha en la tabla de ítems
de Nueva venta), se le gana con el modificador `!` (`!text-right`) o con
`style={{ textAlign }}` (el emoji de Difusión).

Body: `Field` + `Input` / `Select` / `Textarea` dentro de **`GrillaCampos`**
(`components/ui/field.tsx`) — **3 casillas por fila desde `sm`
(`grid-cols-1 gap-3.5 sm:grid-cols-3`), 1 en mobile**. Un campo largo (nombre,
dirección, textarea, buscador) ocupa la fila entera con
`className="sm:col-span-3"`; un par que necesita más aire usa `sm:col-span-2`.
No repetir el string de la grilla a mano. Un flag booleano tipo "activo" va
como checkbox debajo de los campos, **dentro del dialog** — no como botón
aparte en la fila de la tabla (`ServicioDialog`, "Servicio activo", es la
referencia). Título: `id ? "Editar X" : "Nuevo X"`. Para elegir entre opciones
dentro de un form usar **`Select`**, nunca `Tabs` — `Tabs` es el pill de
navegación/filtro de página (Del día/Historial, Celulares/Notebooks/Repuestos/Otros),
no un control de formulario. El ancho (`size`) no se toca por regla general: si
con 3 columnas un dialog `md`/`lg` queda apretado, recién ahí subir un escalón.

## Convenciones al agregar una sección

Para una sección que **ya está migrada** a datos reales (ver lista en
"Backend y multi-tenancy"), seguir el patrón `page.tsx` + `*-client.tsx` +
`actions.ts` + `lib/db/<dominio>.ts` de esa sección como referencia — no el
patrón mock de abajo.

Para migrar una sección que sigue en mock, o agregar una completamente nueva:

1. `app/(app)/<seccion>/page.tsx`: server component, devuelve
   `<Section title="…">` con el fetch inicial vía `lib/db/<dominio>.ts`.
   **El header de sección NO lleva botones ni acciones — solo el título.**
   Las acciones de sección (alta, filtros, «Recuento», etc.) van en la
   **fila de filtros** (`BarraFiltros.accion`), alineadas a la derecha con
   `ml-auto` (o al lado de las `Tabs`). Acciones globales / destructivas (ej.
   «Conciliar cajas») van **abajo** de la página. `Section` no acepta
   `actions`. Si la sección tiene tabla, **toda la página se arma con
   `SeccionTabla`** (ver "Layout estándar de sección con tabla") — no repetir
   el orden a mano.
2. Agregar el ítem a `NAV` en `lib/nav.ts` (href, label, icono de lucide,
   `roles?` si hace falta acotarlo a admin/vendedor/técnico — ver
   `navForRole`).
3. Datos → tabla en `supabase/migrations/` (`organization_id` con `DEFAULT
   current_user_org_id()`, RLS con las 4 policies `to authenticated`) +
   `lib/db/<dominio>.ts` (mapeo snake_case → camelCase a un tipo de
   `lib/types.ts`). La interacción (dialogs, filtros, estado local) va en
   `<seccion>-client.tsx`; las mutaciones en `actions.ts`
   (`requireUser()` + `revalidatePath`).
4. KPIs arriba → `StatCard` (4 por defecto, dentro de `SeccionTabla.tarjetas`;
   8 en Reparaciones, 5 en Cajas · Movimientos). Tablas → `<Card>` +
   `<table>` (headers y celdas ya vienen con estilo del global), como
   children de `SeccionTabla`. Estados → `Badge` + `lib/status.ts`.
   Medios de pago (`MedioPago`): `pesos` ("Efectivo (pesos)" 💵), `dolares`
   ("Dólares" 💲), `transferencia` 🏦, `cripto` 🪙, `tarjeta` ("Tarjeta de
   crédito") 💳 — label/tone/emoji centralizados en `medioPago`
   (`lib/status.ts`), nunca hardcodeados. Los internos (`"pesos"`,
   `"tarjeta"`, `"canje"`, …) no cambian aunque el label sí — son el valor
   persistido en `cajas`/`movimientos_caja`/`compras`
   (`MEDIOS_CAJA` en `lib/status.ts`, fuente única para esos selectores +
   Turnos). **`canje` («Mercadería») y `"cuenta_corriente"` no son medios de
   caja** (plan 020): `Pago.medio` (tipo `MedioPagoVenta`, `MEDIOS_VENTA`
   con los 6 de caja + ambos) es el único lugar donde existen; ninguno mueve
   plata ni genera `movimientos_caja`. `Venta.pagos` es `Pago[]` = `{
   medio, montoUsd, caja, cajaId?, recargoPct?, compraId?, celularId? }[]`
   (1+ medios, pago dividido; la suma de `montoUsd` cubre `totalUsd`, sin
   importar el recargo — ver abajo). Un pago `canje`: no pide caja (`caja`
   queda `"usd"`) y abre `CanjeModal` (mismo archivo): **modelo, IMEI y
   color obligatorios, estado (condición de `CONDICIONES_CELULAR`),
   batería % (no aplica en NUEVO), detalles, testeo opcional
   (`ChecklistEditor`, compartido con Reparaciones) y precio de compra**,
   que ES el `montoUsd` del pago (el campo del pago queda de solo lectura y
   `saldarUltimoPago` saltea los pagos en canje). Sin variante ni marca.
   Validación pura en `lib/canje.ts` (`erroresCanje`, con test), que
   `createVenta` vuelve a correr. Al confirmar, `createVenta` crea **solo**
   la `Compra` `origen: "canje"` (columnas `canje_modelo/color/condicion/
   bateria/testeado` + `imei`, `checklist` si hubo testeo y `aclaraciones`
   = detalles) y guarda `compraId` en el pago: **el equipo no entra al
   stock al vender**, se pasa después desde Compras («Pasar al stock», ver
   "Compras"). Canjes viejos (plan 020) sí crearon el celular `en_revision`
   y tienen `Pago.celularId`.
   Formularios → `Dialog` + `Field`.
   El modal de **Nueva venta** (`app/(app)/ventas/ventas-client.tsx`) es la
   referencia de form completo: eyebrows en mayúscula, cliente existente/
   nuevo, ítems desde el stock (`celulares`/`notebooks`) o libres, y pago dividido con
   conciliación (faltan/sobran/completo + botón «Saldar» — lógica en
   `lib/ventas.ts`, no reimplementarla inline). Cada pago es una tarjeta
   propia (`rounded-lg border`, una fila entera por pago -- varios pagos
   de un pago dividido quedan uno debajo del otro, nunca lado a lado) con
   todo en una sola fila (se apila solo en mobile): primero el **medio**
   (Select con solo los medios que tienen alguna caja activa + "Cuenta
   corriente"), al lado la **caja** en cuanto el medio elegido tiene alguna
   (auto-elegida la primera) — así nunca hay que adivinar a qué caja fue la
   plata aunque dos cajas compartan medio (ver "Cajas" más abajo) — y por
   último el campo «Cobrado», que cambia de moneda según la caja elegida:
   si es ARS pide el monto en pesos y debajo muestra en vivo su equivalente
   en USD (`fmtUsd(montoUsd)`, con `montoUsd = arsIngresado / dolarVenta`)
   a la cotización vigente — es el único lugar de la app donde se tipea en
   ARS en vez de USD, justamente porque ahí es donde el vendedor sabe
   cuántos pesos cobró, no cuántos dólares equivalen. `Negocio.recargosMediosPago`
   (Configuración → Datos del negocio) es un % opcional por medio que
   infla lo que se **cobra/mueve** de verdad
   (`montoConRecargo` en `lib/ventas.ts`) sin tocar `montoUsd` ni la
   conciliación. Al confirmar la venta, cada pago genera su movimiento:
   "Cuenta corriente" → cargo en `movimientos_cc`; el resto → ingreso en
   `movimientos_caja` de la `cajaId` elegida — ambas tablas con `venta_id`
   (`on delete set null`), y `Venta.tieneMovimientoCaja`/`tieneMovimientoCC`
   habilitan el checkbox correspondiente al borrar (ver "Ventas" abajo).
   Un ítem de categoría `servicio` puede además cargar **repuestos
   usados** (`VentaItem.repuestos`, tabla propia `venta_item_repuestos`) —
   descuenta stock de `repuestos` al vender, checkbox propio para
   devolverlo al borrar.
5. Lógica de negocio no trivial (cálculos, gating) → extraerla a
   `lib/<algo>.ts` puro (sin Supabase) con test en `lib/<algo>.test.ts` al
   lado — ver `lib/cajas.ts`/`lib/ventas.ts`.
6. Acciones que "otros usuarios deberían ver" → `publish(...)` de
   `lib/realtime.ts` (ver abajo), llamado desde el client component después
   de que la server action confirmó — nunca desde `lib/db/*` ni `actions.ts`.
7. `npx tsc --noEmit` y `npx vitest run` antes de terminar.

### Notas por sección

- **Agenda** (ex Turnos; `app/(app)/agenda/`, migrado, plan 023): la sección
  se llama «Agenda» en todos lados y vive en `/agenda` (`/turnos` redirige ahí
  con un 308 en `next.config.mjs`, query incluida). La entidad sigue siendo
  «turno» (tabla `turnos`, `lib/db/turnos.ts`, `Turno`) y la ayuda sigue en
  `/ayuda/turnos`. Vistas **Semana / Mes**
  (Semana = lunes a sábado, `DIAS_SEMANA_AGENDA`; la vista Día se sacó a
  pedido del usuario — `?vista=dia` cae a semana; sin botón «Hoy»: la navegación es una pastilla «‹ 23 al 28 de noviembre ›» / «‹ Noviembre de 2026 ›» como la del Dashboard, `etiquetaRango`; turnos superpuestos van lado
  a lado y «+N más» del Mes abre esa semana) con grilla por **media hora** 09–20 h (`PX_POR_HORA` 56);
  **la URL manda** (`?vista=semana|mes&fecha=YYYY-MM-DD`,
  `parseFiltrosAgenda` en `lib/agenda.ts`). Toda la lógica pura (semanas,
  rangos, solapes, `agruparProximos`, `turnosSuperpuestos`, `kpisAgenda` — Turnos hoy (turnos + pedidos abiertos de hoy), Pedidos pendientes (`listPedidosAbiertos`, cualquier fecha), Vencidos (turnos + pedidos) y Atendidos última semana) está
  en `lib/agenda.ts` con test; fechas siempre como string ISO, hora argentina
  (`hoyISO`/`sumarDias` de `lib/date-presets.ts`, nunca `toISOString()`).
  `page.tsx` trae el rango visible (`listTurnosRango`) + `listTurnosProximos`
  (últimos 30 y próximos 14 días, para «Próximos» y KPIs). UI en
  `components/agenda/` (`calendario-grilla` = Semana, `calendario-mes`,
  `evento-bloque`, `proximos`, `turno-detalle`, `agendar-dialog` con modo
  edición). `Turno` suma `fecha`, `duracionMin`, `atiendeId`/`atiende`
  (columnas `duracion_min`, `atiende_id`); `dayOffset` **sigue existiendo**
  (calculado, lo usan dashboard, analíticas, command palette y demo). Estados:
  `pendiente` («Sin confirmar»), `confirmado`, `atendido`, `no_vino`,
  `cancelado`; un turno pasado en `pendiente|confirmado` es **vencido**. El
  color del bloque lo da el tipo (`turnoBlockClass` en `lib/status.ts`, **tonos de la
  paleta índigo** `--chart-*` (siguen el tema; mismo mapeo que `TURNO_TIPO_COLOR`):
  fondo claro vía `color-mix`, `banda` para las tarjetas de «Agenda del local»
  del dashboard — nunca colores sueltos tipo emerald/amber) junto con su ícono (`TURNO_ICONO`,
  `components/agenda/turno-icono.tsx`: compra 🛍 · deja 🔧 · retira 📦 ·
  cotizar 🧮; en bloques, mes, leyenda y Próximos) y el estado la forma
  (claro / borde punteado sin confirmar / apagado / tachado). Los turnos nacen
  `confirmado`, así que «Próximos» solo muestra el estado si no lo es; cada
  tarjeta: horario + tipo arriba, nombre grande, quién atiende abajo, ícono
  grande de fondo (estilo sistema-update). «Próximos» mezcla turnos abiertos y **pedidos sin entregar** (`agruparProximos(turnos, hoy, pedidos)` → `ItemProximo`, el pedido va primero en su día como «Todo el día»); lo que pasó de fecha va en el grupo **«Atrasados»**, tarjeta con borde rojo y «ATRASADO ·» delante del título. Click en hueco →
  alta con fecha/hora precargadas; «Editar» reusa `AgendarDialog` (al
  editar, los celulares/ítems quitados vuelven al stock si estaban
  reservados). Agendar con celulares vinculados los reserva si
  `reservarStock`. **Tienda** (`turnos.tienda_id`, mismo circuito que
  Ventas: `TiendaSeleccion` + `resolveTiendaId`, `null` = la principal;
  se ve en el detalle). Motivo **«Otro»** (`tipo = 'otro'`, ícono
  `Ellipsis`, tono `--chart-4`) con comentario. El cliente se puede
  escribir **«solo el nombre»** (input de texto plano → `tipo: "libre"`),
  además de buscarlo con el picker. **«Copiar texto»** en el menú «Acciones» del detalle del turno y en cada tarjeta de «Próximos» (esquina superior izquierda) (`textoParaCliente`, `components/agenda/turno-detalle.tsx`):
  `textoTurno` (`lib/agenda.ts`, con test) arma Nombre / Motivo / Equipos /
  Día / Horario + Página (tienda del turno o el negocio) y Dirección del
  local, para mandar por WhatsApp. `Turno.clienteId` es nullable a propósito (`ClientePicker`
  con `allowLibre`): turnos de gente aún no registrada. **Pedidos**
  (encargos): tabla `pedidos` (`cliente`/`cliente_id`, `descripcion`,
  `items` jsonb, `sena_usd`, `fecha_entrega`, `estado`
  `pedido|llego|entregado|cancelado`, `nota`; `lib/db/pedidos.ts`,
  `Pedido`/`pedidoEstado`), sin hora: se dibujan en la fila **«Todo el día»**
  de Semana (`CalendarioGrilla`, el hueco libre carga uno con esa fecha)
  y arriba de cada día en Mes (sin cancelados). `PedidoChip` (forma por
  estado, borde rojo si vencido) y `PedidoDialog`/`PedidoDetalle` en
  `components/agenda/`; lógica pura `pedidosDelDia`/`pedidoVencido` en
  `lib/agenda.ts`. **Productos, seña y saldo (plan 028)**: `items` es un
  snapshot `PedidoItem[]` (`detalle`/`cantidad`/`precioUsd`) en jsonb, como
  `Turno.pagos`; el dialog es una tabla editable de productos con precio
  unitario en U$, checkbox «Abonó seña» + `sena_usd` (0 = sin seña) y un
  resumen Total/Seña/Saldo. **Total y saldo no se guardan**: se calculan en
  `lib/pedidos.ts` (`totalPedido`/`saldoPedido`, con test), y `descripcion`
  se **deriva** de los ítems (`descripcionPedido`) en el server — el usuario
  ya no la escribe, pero la columna sigue (`not null`) para el chip, el
  confirm de borrar y los pedidos viejos (`items = []`, se editan con una
  fila precargada y el precio vacío). Validación `errorPedido` reusada por el
  dialog y la action. No mueven stock. **La seña sí mueve caja**
  (`20261126120000_pedidos_sena_caja.sql`): el dialog elige caja activa +
  monto en la moneda de la caja (pesos si es ARS, con su USD a la cotización
  de `useDolar()`), y `lib/db/pedidos.ts` crea un ingreso en
  `movimientos_caja` con `pedido_id` (USD recalculado desde la caja en el
  server, `senaEnCaja`). Editar caja/monto reemplaza el movimiento
  (`cambioSena`, puro con test); una seña ya **conciliada** no se puede
  cambiar; borrar el pedido borra la seña sin conciliar (`on delete set
  null` deja la conciliada). Sin recargo de caja (es un adelanto).
  Fuera de alcance: reservas y convertir el pedido en venta (el saldo se
  cobra con una venta aparte).
  **Seña en turnos** (26/11): cualquier tipo de turno tiene «Abonó seña»
  (caja activa cualquiera + monto en su moneda, `SenaTurnoFields` en
  `agendar-dialog.tsx`) → ingreso en `movimientos_caja` con `turno_id` y
  etiqueta `sena` (`lib/db/senas.ts`, mismo `cambioSena`/`senaEnCaja` que
  los pedidos; `Turno.sena` = `PedidoSena`). Editar reemplaza el movimiento
  salvo que esté conciliado; borrar el turno borra la seña sin conciliar.
  El viejo bloque «Pago» de los turnos de compra (sin caja, `Turno.pagos`)
  ya no se ofrece: los turnos viejos lo conservan y se ven en el detalle.
- **Inventario** (`app/(app)/inventario/`, migrado): 4 tabs — **Celulares**
  (unidades únicas por IMEI, con `Celular.almacenamiento`), **Notebooks**
  (unidades únicas por `Notebook.numeroSerie`, con CPU/memoria/pantalla/
  garantía propios — `lib/db/notebooks.ts`), **Repuestos** (stock por modelo)
  y **Otros** (`OtroItem`: iPad, AirPods, tablets, accesorios; con
  `cantidad`). Repuestos y Otros tienen **Recuento** (edición inline de
  stock/cantidad + guardar) e **Ingreso** (dialog que suma unidades a un ítem
  existente con cantidad + precio compra, o crea uno nuevo). Celulares y
  Notebooks tienen «Agregar celular»/«Agregar notebook». **Click en una fila**
  abre `CelularFormDialog`/`NotebookFormDialog` (ver + editar todos los campos,
  incl. `estado`); el mismo dialog con `celular={null}`/`notebook={null}` es el
  de alta. Los botones de acción van en una toolbar sobre la tabla (`ml-auto`),
  no en el header.
  `Repuesto.proveedor` es texto libre en la UI pero FK a `proveedores` en la
  base — `lib/db/inventario.ts` resuelve "buscar o crear por nombre". Cada
  alta/edición/recuento/ingreso deja un registro en `movimientos_stock`
  (historial por ítem, antes hardcodeado en el mock).
  **Variantes (plan 024, solo celulares)**: una **variante** (`variantes`,
  `lib/db/variantes.ts`) es `grupo` (nombre libre) + `modelo` + `almacenamiento`
  + `condicion` + `color` opcional (`""` = cualquier color) + `sku` único por
  org + `precio_usd` + `stock_minimo` + `activa`. La unidad (`celulares`)
  apunta a su variante (`variante_id`, NOT NULL) y conserva `precio_propio`
  (si es `false`, su `precio_usd` sigue al de la variante). Los datos clave
  (`modelo`/`almacenamiento`/`condicion` y el color si la variante lo define)
  **se copian de la variante** en `createCelular`/`updateCelular`/
  `createCelularesBulk` — nunca se confía en los que manda el cliente. Lógica
  pura en `lib/variantes.ts` (clave normalizada, `buscarVariante` con
  preferencia de color, `skuSugerido` (condición en el SKU solo `NUEVO`/`USADO`,
  `condicionSku`; la clave sí lleva el grado), stock/rango de precio, `cruzoMinimo`;
  con test). Inventario → Celulares abre en vista **Agrupada** (grupo ›
  variante › unidad, `components/inventario/variantes-tabla.tsx`, toggle
  «Agrupado / Unidades» persistido en `localStorage`; los grupos arrancan
  **plegados**, y abiertos si hay búsqueda/filtro; «Disponibles» del grupo
  y de cada variante se tiñen: rojo sin stock, ámbar si alguna variante
  activa está bajo su `stock_minimo`); herramientas:
  renombrar grupo, editar variante, unir, desactivar/reactivar («Ver
  desactivadas»), eliminar (solo sin unidades) y **stock mínimo** con chip
  «Stock bajo» + evento `low_stock`. El selector
  (`components/inventario/selector-variante.tsx`, 2 pasos + alta con
  `VarianteDialog`) es **obligatorio** en las 3 vías de alta: formulario
  manual, importación (columna virtual «Variante» por fila) y canje.
  Roles: crear/editar/renombrar = `requireEscritura`; unir/desactivar/
  eliminar = `requireRoleEscritura("admin")`.
  **Variantes de notebooks** (`20261124230000_variantes_notebooks.sql`):
  misma tabla `variantes` con `categoria = 'notebook'` + columnas `memoria` y
  **`pantalla`** (`""` en celulares; 27/11,
  `20261127100000_notebooks_pantalla_resolucion_ciclos.sql`). Clave =
  modelo|memoria|almacenamiento|pantalla|CONDICIÓN, sin color (`claveVariante`
  con `categoria: "notebook"`, `clave_notebook` de 5 args en SQL; la pantalla
  se compara con `normalizarPantalla`/`norm_pantalla`: 13,6" = 13.6 pulgadas);
  SKU `MACBOOK-AIR-M2-16GB-512GB-13-6-USADO`. La pantalla es obligatoria al
  crear/editar una variante de notebook; una variante vieja sin pantalla
  sirve para cualquiera (`buscarVariante`). `notebooks.variante_id` +
  `precio_propio`; `createNotebook`/`updateNotebook`/`createNotebooksBulk`
  copian modelo/memoria/almacenamiento/pantalla (si la variante la define)/
  condición (y precio si no es propio) de la variante. Cada notebook además
  tiene `resolucion` y `ciclos_bateria` (solo usadas) propios.
  **Usados = precio propio por defecto** (`precioPropioPorDefecto`,
  `lib/variantes.ts`): al elegir una variante usada en el alta, la unidad
  arranca con precio propio (precargado con el de la variante), porque cada
  equipo vale según su estado. **IMEI/serie obligatorio** en celulares y
  notebooks (form, `createCelular`/`updateCelular`/bulk, `notebookSchema`,
  importación). Todo `lib/db/variantes.ts` toma la categoría de la
  variante (tabla de unidades, `item_type` de movimientos); `listVariantes`
  trae solo celulares salvo `categoria` (`"todas"` en Inventario, Ventas y
  Configuración). `SelectorVariante`/`VarianteDialog`/`VariantesTabla`
  reciben `categoria`; Notebooks también abre **Agrupada** (toggle propio,
  `tekly:ui:inventario-notebooks-vista`), la importación pide la variante
  por fila y Nueva venta avisa `low_stock` también por notebooks.
  `variante_id` de celulares **y** notebooks sigue nullable hasta aplicar
  `20261124200000_variantes_not_null.sql` (después del deploy).
- **Reparaciones** (`app/(app)/reparaciones/`, migrado): 2 tabs — **Tickets**
  (pipeline + tabla) y **Servicios** (`components/servicios-catalogo.tsx`,
  catálogo editable). **No hay sección `/servicios`**, vive acá. No hay
  tabla de "técnicos": el selector de "Nuevo ticket" ofrece cualquier
  `profiles` activo de la organización, no solo `rol = 'tecnico'` — en
  equipos chicos el admin o un vendedor también arman tickets
  (`lib/db/reparaciones.ts` → `listTecnicos`). El detalle de ticket tiene 3
  documentos, los 3 con `compacto` (ver "Recibos / PDFs" — negocio arriba a
  la derecha en vez del logo, "Información cliente" en vez de "Datos de
  facturación") y "Información del equipo" a dos columnas con línea
  separadora por fila (`ReciboCampos` con `variant="inline"` +
  `separadores`): **«Ticket de ingreso»** (ex "Recibo de mercadería"),
  **«Ticket de egreso»** (ex "Recibo de entrega", visible con `estado` en
  `listo`/`entregado`) y **«Presupuesto»** (si hay `servicios` cargados —
  pensado para mandarle al cliente, ver más abajo). Cada uno tiene su propio
  texto de "Términos y condiciones" (`Negocio.reparacionTerminosIngreso`/
  `reparacionTerminosPresupuesto`/`reparacionTerminosEgreso`, editables por
  separado en Configuración → Recibos, análogos a los `garantia*` de Ventas
  pero uno por documento en vez de compartido). El **Ticket de ingreso**
  además muestra el `color` del checklist de ingreso (ver más abajo) en
  "Información del equipo", junto a Marca/Modelo/Serial, y cierra con un
  bloque **«Aclaraciones»** propio (`Negocio.reparacionAclaracionesIngreso`,
  mismo criterio editable que los términos y condiciones pero un texto
  libre aparte, no una condición legal). "Nuevo ticket" además de
  Cliente/Falla/Técnico pide: `marca` (nuevo campo, casi siempre "Apple" --
  el negocio solo repara iPhones), `equipo` (el campo de siempre, se
  muestra como "Modelo"), `imei` (existía en la base pero nunca se cargaba
  desde la UI, ahora sí), `reparacionSolicitada`/`claveCodigo`/
  `descripcionEquipo` (todos opcionales) y el **checklist de ingreso**
  (`Ticket.checklistIngreso`, jsonb): 22 ítems fijos
  (`CHECKLIST_ITEMS`/`checklistItemLabel` en `lib/status.ts`, tipo
  `ChecklistItemId` en `lib/types.ts`) con estado `bien`/`mal`/`na` por ítem
  (`ChecklistEditor`, `components/ui/checklist-editor.tsx` — compartido con
  el equipo recibido en canje de Ventas, ver "Ventas" más arriba; grilla de
  a 3 + botones «Marcar todo bien»/«No se testeó») + `color` suelto (texto
  libre, es un dato de identificación, no un chequeo -- se carga junto con
  "Datos del equipo" en el form, aunque persiste dentro del mismo jsonb
  `checklistIngreso`). El **checklist de egreso**
  (`Ticket.checklistEgreso`) es aparte a propósito: se completa con el
  botón «Checklist» en el detalle del ticket, en cualquier momento antes de
  entregar — no depende de avanzar el `estado`. `ReciboChecklist`
  (`components/recibos/recibo.tsx`) imprime un checklist solo (Ticket de
  ingreso/egreso); `ReciboChecklistComparado` imprime los dos juntos,
  ítem por ítem, columnas Ingreso/Egreso una al lado de la otra -- solo en
  Presupuesto, que es el que se manda al cliente y quiere mostrar el
  "antes y después" en una sola tabla. "Servicios asociados" tiene botón
  «Agregar» (`AgregarItemDialog`) con 3 orígenes: **catálogo** de servicios
  (precio/`garantiaDias` fijos del catálogo), **repuesto** de inventario
  (descuenta stock al agregarlo, lo repone si se quita —
  `addTicketItem`/`removeTicketItem` en `lib/db/reparaciones.ts`, mismo
  patrón leer-y-escribir que `venta_item_repuestos`; sin precio de venta
  propio en `Repuesto`, se carga a mano) o **libre** (nombre + precio a
  mano). `TicketServicio.origen`/`repuestoId`/`cantidad`/`garantiaDias` son
  todos opcionales -- un ticket de antes de esta feature no los tiene, se
  trata como `origen: "servicio"`. El precio de un ítem ya cargado se puede
  editar en la fila (ícono de lápiz, `updateTicketItemPrecio` en
  `lib/db/reparaciones.ts` -- solo toca `precioUsd`, no descuenta/repone
  stock). `presupuesto_usd` se recalcula solo, suma de `precioUsd *
  cantidad` de todos los ítems. **Rentabilidad del ticket** (admin/técnico,
  bloque bajo "Servicios asociados"): `rentabilidadTicket`
  (`lib/reparaciones.ts`, con test) = presupuesto − costo de repuestos; la
  mano de obra no tiene costo. `addTicketItem` **congela** el costo del
  repuesto en `TicketServicio.costoUsd` (lo lee del server, nunca del
  cliente); tickets viejos caen al costo actual. Analíticas («Gasto en
  repuestos») usa lo mismo. `ticketParaRol` borra ese costo antes de mandar
  tickets a un vendedor (page, actions, Agenda). Ticket de ingreso/egreso muestran una sola
  tabla de servicios (`ReciboLineas`, columna Garantía si algún ítem la
  trae). **Presupuesto** en cambio separa los ítems en hasta 3 tablas por
  `origen` (Servicios/Repuestos/Ítems extra, cada una oculta si no tiene
  ítems) con un total general aparte -- Garantía solo en la tabla de
  Servicios (`lineaDeItem`), Repuestos/Ítems extra no la traen
  (`lineaSinGarantia`) porque no tienen garantía de catálogo.
- **Ventas** (`app/(app)/ventas/`, migrado): **la URL es la fuente de
  verdad de los filtros** (`lib/ventas-filtros.ts`, con test): `preset`
  (default `mes`), `desde`/`hasta`, `vendedor` (id de `profiles`, no
  nombre), `tipo` (rubro de los ítems vía `categoriaDe`, no `Venta.tipo`),
  `q`, `vista` (`ventas`/`items`), `page`, `sort` (`fecha`/`total_usd`/
  `numero`/`margen_pct`) y `dir`. Params inválidos caen a los defaults; un
  vendedor no puede ordenar por margen ni por URL. El server (`page.tsx`)
  parsea, arma el rango en **hora de Argentina** (nunca `toISOString()`) y
  llama en paralelo a `listVentasPagina`/`listItemsVendidosPagina` (`.range`
  + `count: "exact"`, 50 por página), `contarVentas`/`contarItemsVendidos`
  (contadores de los tabs), `resumenVentas` (KPIs del período **completo**,
  no solo la página, con `resumenDeVentas` puro) y `resumenVentas` del
  período anterior (`periodoAnterior` de `lib/date-presets.ts`) para el
  `delta` de cada `StatCard`. La búsqueda `q` matchea número exacto,
  `cliente ilike` e ítems (`venta_items.detalle` + `celulares.imei`, tope 500
  ids). El cliente deja de tener `list`/`filtered` en estado: cada cambio de
  filtro hace `router.replace` con la URL nueva (vuelve a `page=1`) dentro
  de `startTransition`; mientras carga la tabla baja a `opacity-60`, y el
  buscador tiene debounce de 300 ms. Hay chips de filtros activos + "Limpiar
  todo", y el botón "Filtros · N" en mobile. **Paginador** reutilizable
  `components/ui/pagination.tsx` (`paginasVisibles` en `lib/pagination.ts`,
  con test). Alta y baja de venta → `router.refresh()` (ya no se muta una
  lista local). Deep link `?open=<id>` (lo usa "Ventas recientes" del
  dashboard): si la venta está en la página se abre de la lista, si no
  `getVenta(id)` la trae aparte (`ventaAbierta`); al cerrar se saca el
  param. `?q=` y `?accion=nueva-venta` del CommandPalette siguen andando.
  **Alineación**: todo centrado (ver "Reglas globales de tablas"), montos
  con `tabular-nums`, acciones al final en columna angosta.
  La lista es una tabla (`VentaCardMobile` debajo de `md`) con Venta
  (`V-1042` + fecha), Cliente, Detalle, Pago (**un solo chip**: el medio de
  mayor `montoUsd` + "+N", `title` con el detalle vía `montoPagoLabel`),
  Margen (solo `puedeVerCosto`) y Total; los headers Venta/Total/Margen son
  ordenables. Se sacó la columna Costo de la lista (queda en el detalle).
  El detalle (`VentaDetalle`) tiene footer de **3 botones** (Eliminar
  admin, Cerrar y un menú **«Imprimir ▾»** con «Recibo y garantía (juntos)» / «Solo recibo» / «Solo garantía» (la garantía de la venta junta todos los ítems en una tabla; `TipoImpresion` en `ventas-client.tsx`),
  navegable con flechas); "Ver compra de canje" pasó al bloque de pagos; el
  viejo "Resumen financiero" se parte en **Pagos** (una fila por pago: chip
  de medio + caja + monto, recargo/cotización, link de canje, total cobrado)
  y **Rentabilidad** (Costo/Ganancia/Margen en 3 `StatCard`, solo
  `puedeVerCosto`). "Ítems vendidos" es una query paginada aparte
  (`listItemsVendidosPagina`, `venta_items` con `ventas!inner`) con 1 fila
  por ítem (Venta/Cliente/Ítem/Serie/Precio/Margen) y abre el mismo
  `VentaDetalle`. La columna Acciones de Ventas es un menú **⋯**
  (`MenuAcciones`, `components/ui/menu-acciones.tsx`: portal + `fixed`, porque
  la tabla recorta con `overflow-x-auto`) con las mismas 3 opciones;
  "Ítems vendidos" conserva el ícono de Garantía por ítem — mismo diseño,
  mismo `garantiaContenido(items)` en `ventas-client.tsx`.
  `VentaItem.costoUsd?` y
  `Venta.procedencia?` existen; el costo NO se edita en el modal de
  alta. **Margen**: `margenVenta(items)` (`lib/ventas.ts`, con test) es la
  única fuente del costo/ganancia/margen de una venta — solo ítems con
  `costoUsd` cargado (mismo criterio que `margenPorTipo` en Analíticas);
  venta sin ningún costo → "—" en tabla/detalle (sin dato, no 100 %).
  **Ganancia a la vista** (admin/técnico): columna «Ganancia» (U$) en Ventas
  e Ítems vendidos, tarjeta «Ganancia» (`ResumenVentas.gananciaUsd`,
  `gananciaTotal`; para admin/técnico reemplaza a «Ticket promedio») y, en
  Nueva venta, costo unitario editable por ítem (precargado del stock) +
  `RentabilidadEnVivo` bajo el total. Servicios del catálogo e ítems libres
  arrancan **sin costo** (`undefined`, no 0 → no inflan el margen); los
  repuestos usados de un servicio se suman al costo guardado del ítem
  (`costoUnitarioItem`, `lib/ventas.ts`). `page.tsx` borra `margenPct`/
  `gananciaUsd` del resumen para el vendedor. El KPI
  "Margen promedio" usa `margenPonderado(ventas)` (ponderado por
  facturación, `null` → "—" con hint "sin costos cargados") — nunca el
  promedio simple de `margenPct`. La columna `margen_pct` se persiste con
  el mismo criterio (`margenVenta(...) ?? 0`) y se recalculó histórica en
  `20261004140000_ventas_recalcular_margen.sql` (solo margen: la cotización
  de pagos en pesos de ventas anteriores NO se reconstruyó); la UI no la lee para
  mostrar margen (calcula desde los ítems). Vender un ítem con `celularId`
  marca ese equipo `vendido`. "Cliente
  nuevo" en el modal ahora persiste de verdad (`createCliente`) antes de
  crear la venta. El margen/restante/saldar del pago dividido usan
  `lib/ventas.ts` (con tests), no lógica inline.
  **Montos de pagos en pesos**: `Pago.cotizacion`/`Pago.montoArs`
  (snapshot persistido en el `jsonb` de `pagos` por `createVenta`) — el
  `montoArs` ES el `monto` del movimiento de caja generado (recargo
  incluido). La UI muestra pagos ya guardados con `montoPagoLabel`
  (`lib/ventas.ts`): ARS con snapshot → `fmtArs(montoArs)`; venta vieja
  sin snapshot → USD + aclaración "Monto en pesos no registrado" en el
  detalle; **nunca** se recalcula con el blue de hoy (mismo
  criterio anti-hidratación que el resto de los montos persistidos). El
  blue en vivo (`useDolar()`) solo se usa dentro de `NuevaVentaDialog`
  (operación todavía no persistida). El recargo se muestra en el detalle
  ("+ 10 % recargo") cuando el pago lo tiene.
  **Precio mayorista, precio editable y diferencia (25/11)**:
  `precio_mayorista_usd` (opcional) en `variantes`, `celulares` y
  `notebooks`; el efectivo es el de la unidad o el de su variante
  (`precioMayoristaDe`, `lib/precios.ts`, puro con test). Con modalidad
  «Mayorista», Nueva venta usa ese precio (`precioSegunModalidad`) y cambiar la
  modalidad re-precia lo que nadie tocó a mano. **Solo un admin edita el precio
  de venta** de un ítem en el modal; `createVentaAction` lo revalida contra la
  base (`preciosDelStock` + `errorPrecioItem`): un no-admin solo puede mandar
  el de lista (o el mayorista en una venta mayorista). Servicios no se validan
  (el ítem no guarda el id del servicio). **Faltante de cobro**: ya no bloquea
  (`motivoNoConfirmable` con `permitirFaltante`); al confirmar aparece el cartel
  «¿Seguro que querés pasar la venta con U$ X menos…?» y la venta guarda
  `ventas.diferencia_usd` (`Venta.diferenciaUsd`), que `createVenta` revalida
  (`errorDiferencia`: tiene que coincidir con total − cobrado; lo que sobra
  sigue rechazado). **La diferencia resta de la ganancia**: `preciosConDiferencia`
  (`lib/ventas.ts`, con test) la reparte en los ítems igual que el descuento
  (`ajuste_usd` = descuento + diferencia, total = lo cobrado), así margen,
  Analíticas, dashboard y resumen mensual la descuentan sin tratarla aparte.
  `descuentoSinDiferencia` separa el descuento propio para mostrarlo; el
  detalle muestra «Diferencia sin cobrar» y la lista «−U$ X sin cobrar». El
  recibo del cliente la muestra dentro de «Descuento».
  **Seña y vuelto (26/11, igual que sistema-update)**: cada pago de Nueva
  venta lleva su etiqueta («Método 1», «Método 2»…) y debajo van siempre
  las filas «Seña» y «Vuelto» (vacías en «Sin seña»/«Sin vuelto» hasta
  elegir un medio, `FilaPagoVacia`/`EtiquetaFilaPago`). La seña es un `Pago` más
  con `sena: true` (suma a lo cobrado; su ingreso de caja lleva «Seña ·
  Venta V-…»). Seña y vuelto van a **cualquier caja activa** (el medio es
  cómo pagó/se devolvió, la caja es independiente, `cajaPara`); la moneda
  de cada pago la pone el server desde su caja (`monedasDeCajasActivas`). El vuelto es `Venta.vuelto` (`VueltoVenta`,
  columna `ventas.vuelto jsonb`, `20261126160000_ventas_vuelto.sql`): medio +
  caja + monto (pesos si la caja es ARS, snapshot `montoArs`); cobrado =
  Σ pagos − vuelto (`cobradoNeto`, `calcularRestante(total, pagos, vuelto)`,
  `errorVuelto`, `lib/ventas.ts`), y genera un **egreso** en esa caja con
  `venta_id` (se borra con «Borrar movimientos de caja»). El server toma
  la moneda de la caja (`vueltoDeCaja`). **Etiqueta en Cajas**:
  `movimientos_caja.etiqueta` (`sena`|`vuelto`,
  `20261126170000_caja_etiqueta_sena_turnos.sql`, `MovimientoCaja.etiqueta`)
  la ponen las ventas, los pedidos y los turnos; Cajas la muestra como chip
  al lado del concepto (`EtiquetaMov`). «Ingresos por medio de pago»
  (Analíticas y resumen mensual) usa `montosPorMedio` para restarlo. No hay
  todavía vínculo seña de un Pedido (Agenda) → venta: si la seña ya entró
  por un pedido, no volver a tildarla en la venta (se duplicaría en caja).
  **Carrito «Vender desde el stock» (26/11)**: botón 🛒 (`BotonCarrito`) en
  cada celular/notebook `disponible` de Inventario (vista Agrupada y
  Unidades, tabla y mobile); el carrito vive en `sessionStorage`
  (`tekly:carrito-venta:v1`, store `useSyncExternalStore` en
  `components/ventas/carrito-venta.tsx`; lógica pura en `lib/carrito-venta.ts`,
  con test) y se abre desde el botón 🛒 del `FabDock` (píldora flotante abajo
  a la derecha; se aparta **sola** hacia la derecha, dejando a la vista la mitad de los botones, mientras se
  scrollea hacia abajo o cuando quedaría encima de algo clickeable de la
  página — `elementsFromPoint` sobre su lugar —; el mouse sobre esa mitad la
  trae de vuelta, sin botón de ocultar), junto a la lupa
  (`PanelCarrito`, con contador). «Pasar a la venta» →
  `/ventas?accion=nueva-venta&carrito=1`: `VentasClient` filtra lo que sigue
  disponible (`filtrarDisponibles`, avisa lo que quedó afuera) y lo pasa como
  `precarga` a `NuevaVentaDialog`, que arma los ítems con los mismos
  `catDeCelular`/`catDeNotebook`/`draftDeCatalogo` que el buscador. Se vacía
  al confirmar la venta; cancelar lo conserva.
  **Descuento y regalos (plan 026, revisado 25/11)**: en «Nueva venta» los
  ítems se listan como «1x NOMBRE … U$850» (`usdPegado`, sin espacio);
  cantidad y costo salen del catálogo. Para cobrar
  menos hay un **descuento** en U$ o % (`ventas.ajuste_usd` ≥ 0; la columna
  admite signo por historia, pero `errorAjuste`/`errorItemsVenta` rechazan
  negativos: no hay recargo). Los **regalos son por ítem**: un segundo
  buscador «Agregar regalo» (**repuestos u Otros** con stock) agrega el ítem
  con `regalo = true`, precio 0 y **su costo** (baja la ganancia). Un
  repuesto regalado es un ítem `categoria: "otro"` con el repuesto en
  `VentaItem.repuestos` (mismo circuito que los repuestos usados de un
  servicio: `venta_item_repuestos`, descuenta stock, se devuelve con
  «Devolver los repuestos»; costo vía `costoUnitarioItem`). **Solo se
  vende stock** (celular, notebook, producto de Otros) o servicios del
  catálogo — no hay ítems libres (`errorItemsVenta`). Vender o regalar un
  producto de Otros **descuenta su stock** (`venta_items.otro_id`/
  `otro_serial`, `moverStockOtro` en `lib/db/inventario.ts` con la regla
  pura `movimientoStockOtro` de `lib/otros.ts`: por cantidad resta,
  serializado marca la unidad `vendido`; borrar la venta con «Devolver al
  inventario» lo repone). Si **todos** los ítems son regalo
  (`esVentaRegalo`), la venta es «Regalo»: `ventas.regalo = true`, total 0
  y sin pagos. En el pago, los medios sin caja activa salen «(sin caja)»
  deshabilitados con un aviso que linkea a Cajas (cada forma de cobro =
  una caja con su medio y moneda).
  `preciosDeVenta` (`lib/ventas.ts`, con tests) es la única cuenta, usada
  por `createVenta`, la demo y el modal: regalos en 0 y descuento
  prorrateado en el resto (`aplicarAjusteVenta`) → `venta_items.precio_usd`
  queda **efectivo** (Σ precio × cantidad = `total_usd`) y
  `precio_lista_usd` guarda el de lista en las líneas tocadas, así margen,
  Analíticas, dashboard y resumen mensual siguen correctos. **El server
  recalcula** todo (`errorItemsVenta`: al menos un ítem que no sea regalo,
  un celular/notebook no se regala). `ventas.regalo` (venta entera) quedó
  por compatibilidad: la UI ya no lo ofrece. En lista/detalle «−U$ X desc.»;
  el recibo imprime precios de lista con el descuento como ajuste
  (`ReciboLineas.ajustes`). En el modal, el **vendedor** se elige de la lista
  de usuarios del sistema o «Otro (escribir a mano)», y en ese caso el nombre
  se escribe **en la misma casilla** (con un botón para volver a la lista);
  «Nueva tienda» abre un `Dialog` y queda seleccionada, y cada pago es **una
  sola fila** (scroll horizontal en mobile, sin apilar).
  **Vendedor de la venta**: cualquier rol elige a cualquier usuario
  **activo** de la organización (`listUsuariosVenta`, todos los roles) o
  «Otro (escribir a mano)» (`vendedorId` vacío + nombre; columna
  `ventas.vendedor_nombre`, solo cuando `vendedor_id` es null —
  `toVenta` muestra `profiles.nombre ?? vendedor_nombre`). Arranca en el
  usuario actual. `createVentaAction` valida con `resolverVendedor`
  (`lib/ventas.ts`, con test): el nombre de un usuario sale de `profiles`,
  nunca del cliente; un id que no es de un usuario activo de la org se
  rechaza. Una venta a mano no entra en el filtro por vendedor (filtra por
  `vendedor_id`) ni en las métricas propias del dashboard del empleado.
  **Tienda / página** (`ventas.tienda_id` → tabla `tiendas`, `lib/db/tiendas.ts`):
  para negocios que manejan más de una página desde la misma cuenta.
  `null` = la principal (el nombre de la organización, no es una fila).
  Nueva venta ofrece la principal (default), las `tiendas` activas y
  «+ Nueva tienda…» (`TiendaSeleccion`, creación diferida al confirmar como
  `ClienteSeleccion`); `resolverTienda` (`lib/tiendas.ts`, con test) reusa
  una existente con el mismo nombre (sin mayúsculas/espacios) y trata el
  nombre de la principal como principal. Con tiendas extra, toda venta muestra
  la suya (la principal incluida) en el detalle y como chip `TiendaTag` bajo
  el número (Ventas e Ítems vendidos); filtro `?tienda=` (`principal` = sin
  tienda, o el id; `TIENDA_PRINCIPAL` en `lib/ventas-filtros.ts`), que aplica
  también a KPIs y gráficos. Pendiente: administrarlas (renombrar/desactivar)
  y membrete del recibo por tienda.
  `VentaItem.categoria`
  (`"celular" | "notebook" | "servicio" | "otro" | "libre"`) guarda el `origen` con el que
  se agregó el ítem en el modal -- alimenta `ventasPorRubro` de
  `lib/dashboard.ts` (ver Dashboard abajo) y `margenPorTipo` de
  `lib/analiticas.ts` (ver Analíticas abajo), vía el `categoriaDe`/
  `RUBRO_LABEL` compartido en `lib/ventas.ts`; es opcional porque ventas
  creadas antes de este campo no lo tienen. Persistencia: tabla propia
  `venta_items` (ver "Backend y multi-tenancy"), no `jsonb` en `ventas`.
  Al confirmar una venta aparece **`VentaConfirmada`**
  (`components/ui/venta-confirmada.tsx`): check verde grande + «Venta
  confirmada» + «V-1042 · cliente · U$850» a pantalla completa; se cierra
  sola (~2 s), con click o Esc.
  «Eliminar venta» (admin-only) abre un `ConfirmDialog` con hasta 5
  checkboxes independientes, cada uno visible solo si aplica: devolver los
  celulares/notebooks vendidos a `disponible`, devolver los repuestos usados al stock,
  borrar el/los movimiento(s) de caja generados, borrar el movimiento de
  cuenta corriente generado (ver "Medios de pago" arriba), borrar la
  `Compra` de canje generada **y el celular recibido** (solo si sigue
  `en_revision`/`disponible`; si ya se movió se conserva y se avisa con un
  banner) — `deleteVenta` (`lib/db/ventas.ts`) recibe
  los 5 como un objeto de opciones. La fila se saca de la lista recién
  cuando la action confirmó (si falla, el error se muestra dentro del
  `ConfirmDialog` y la venta no "desaparece"); `createVenta` compensa una
  falla a mitad con ese mismo `deleteVenta` (todo en `true`) para no dejar
  ventas/celulares/movimientos a medias — no es una transacción real,
  ver el comentario en `lib/db/ventas.ts`.
- **Clientes** (`app/(app)/clientes/`, migrado): tabla (no cards). Soporta
  deep link `/clientes?open=<id>` (`useSearchParams`, mismo patrón que
  Compras) — es a donde linkean el mapa de valor, las cohortes y las listas
  de atención del tab Clientes de Analíticas. Fila →
  ficha con historial cruzado real (ventas/tickets/turnos vía
  `lib/db/clientes.ts`); toolbar «Nuevo cliente». `compras`/`reparaciones`/
  `gastadoUsd` son calculados, no columnas — ver "Backend y multi-tenancy".
  «Nuevo cliente» tiene un campo opcional "Fecha de nacimiento" -- es lo
  único que alimenta el widget de demografía por edad (`fecha_nacimiento`
  en la tabla, `lib/clientes.ts` para el cálculo puro).
- **Cajas** (`app/(app)/cajas/`, migrado): `Caja` (`lib/types.ts`) = `{ id, nombre,
  moneda: "usd" | "ars", activa, descripcion, creadaEl, medioPago, recargoPct }` — puede
  haber varias por moneda (Mostrador/Taller en ARS, Caja USD/Bóveda USD en
  USD) y varias cajas pueden compartir el mismo `medioPago` (ej. Mostrador y
  Taller son las dos "pesos"). Cada caja tiene **un** medio de pago fijo
  (se configura en `CajaDialog` al crearla/editarla: **Moneda ARS/USD** +
  **Efectivo · Transferencia · Cripto · Tarjeta · Otro**; «Efectivo» se
  guarda como `pesos`/`dolares` según la moneda — `medioDeCaja`/
  `tipoDeMedioCaja` en `lib/cajas.ts`, con test —, y `otro` es un medio
  nuevo, migración `20261125200000_medio_pago_otro.sql`) y un **Recargo %**
  (0–100, plan 027; `errorRecargo` en `lib/cajas.ts`, con test) que se suma a
  lo que se cobra en esa caja — es la fuente del recargo de los pagos de
  Ventas/Reparaciones (`conRecargoDeCaja` en `lib/db/cajas.ts`) y se ve en la
  columna «Recargo». En «Nuevo movimiento»
  no se elige medio de pago por separado, se completa solo al elegir la
  caja. `MovimientoCaja.monto` está en la moneda de su `cajaId`. Arriba, un
  `StatCard` por medio de pago (`transferencia`, `pesos`, `tarjeta`, …;
  el monto grande va en la moneda de sus cajas —U$ si todas son en dólares,
  `monedaDeMedio`— y la conversión a la otra moneda abajo) + **Total (ARS)**; los de medio de pago funcionan como
  filtro de la tabla (igual que el pipeline de Reparaciones). Debajo, toolbar:
  **«Nuevo movimiento»** y **«Nueva caja»** van en las tres pestañas
  (`accionesCajas`); Conciliaciones suma **«Conciliar cajas»**.
  **No hay "cerrar caja del día"**: el modelo es de conciliación con ventana
  flexible ("desde la última conciliación", no obligatoria por día) — si no
  se concilia un día, los movimientos simplemente se acumulan, nada se
  bloquea. La tabla real es **una sola** `movimientos_caja` con
  `conciliacion_id` nullable (`lib/db/cajas.ts`): `null` = "desde la última
  conciliación" (`soloSinConciliar: true`, equivalente al `movimientosHoy`
  del mock viejo), no-`null` = ya archivado (equivalente a
  `movimientosPrevios`) — nada se mueve entre arrays, solo se actualiza esa
  columna. Toggle de la tabla: **Desde conciliación** (neto contra lo
  esperado, vía `netoMovimientos` de `lib/cajas.ts`) **/ Historial** (todo).
  Conciliar abre `ConciliarDialog`: por cada caja activa hay que anotar el
  monto real contado (obligatorio) + un comentario opcional; la diferencia
  contra `montoSistemaDe(cajaId)` se calcula sola y se guarda como
  `ConciliacionLinea` dentro de un `Conciliacion` (`lib/types.ts`) — eso
  alimenta el panel "Conciliaciones anteriores". Al confirmar
  (`crearConciliacion`), se inserta la conciliación y se archivan bajo ella
  todos los `movimientos_caja` con `conciliacion_id is null`.
  Sección **Cajas** (al final de la página, colapsable como los gráficos de
  otras secciones): tabla CRUD de las `Caja` — alta con «Nueva caja», edición
  con «Editar» (`CajaDialog`, incluye el checkbox "Caja activa" para
  desactivar/reactivar — no hay botón de desactivar aparte en la fila).
- **Compras / Ingresos** (`app/(app)/compras/`, plan 025 fase 1): **toda
  entrada de stock pasa por una compra** — Inventario ya no tiene altas
  (su botón «Ingresar equipo» es un `ButtonLink` a `/compras?accion=nueva-compra`;
  «Agregar unidad» de una variante agrega `&variante=<id>`; «Reponer» va a
  Nueva compra) y se borraron las server actions de alta de
  `inventario/actions.ts`. `compras.sube_stock`: con el switch «Subir al
  stock» los ítems son tipados (`ItemCompraStock` en `lib/compras.ts`:
  celular/notebook con variante, repuesto, otro) y se cargan con los mismos
  `CelularFormDialog`/`NotebookFormDialog`/`IngresoDialog` de Inventario en
  `modoCompra` (agregan al carrito, sin «Confirmar ingreso»). `createCompra`
  recalcula `items`/`totalUsd` en el server (`snapshotItems`,
  `resumenCompraStock`), valida (`erroresCompraStock`), nace `recibida`, y
  `ingresarItems` crea cada unidad con el costo **prorrateado**
  (`prorratearCostos`: `costos_adicionales_usd` en proporción al subtotal,
  centavos exactos) + una fila en **`compra_items`** (vínculo a la unidad,
  historial de la pestaña **Ingresos**, `listIngresos`). Unidades y
  `movimientos_stock` llevan `compra_id`; el canje también lo llena. Si algo
  falla a mitad, compensa con `deleteCompra({ quitarDelStock: true })`.
  `deleteCompra` saca del stock solo celulares/notebooks `en_revision`/
  `disponible` y resta repuestos/otros sin bajar de 0; devuelve
  `conservados`. **Reingreso de un equipo dado de baja**: eliminar un
  celular/notebook es baja lógica (`activo = false`) y el `UNIQUE` de
  IMEI/serie incluye a los inactivos, así que `createCelular`/`createNotebook`
  y sus `*Bulk` **reactivan esa misma fila** con los datos nuevos
  (`compra_id` = el ingreso nuevo, movimiento «Reingreso a inventario…»).
  La validación de duplicados (`listImeisExistentes`/`listSeriesExistentes`)
  mira solo activos; `deleteCompra` saltea unidades cuyo `compra_id` ya es de
  otra compra. Sin subir al stock, la compra es la de siempre (gasto,
  texto libre). Medio y caja salen de las cajas activas (medios sin caja «(sin caja)» deshabilitados + link a Cajas); el checkbox «Registrar movimiento» decide si se manda `cajaId` (egreso en esa caja) o la compra no mueve plata. «Importar datos» sigue siendo la
  carga inicial. Pendiente (fases 2–3): Leer con IA (texto/foto/PDF), lote y
  QR.
- **Compras** (detalle de siempre): espejo de Ventas del lado del
  gasto. `Compra.origen` distingue las dos formas en que se llega acá:
  `"proveedor"` (de siempre) — alta con proveedor (texto libre en la UI,
  resuelto a `proveedores` igual que en Inventario — `resolveProveedorId`,
  exportada desde `lib/db/inventario.ts` y reusada acá), ítems
  (detalle/cantidad/costo), medio de pago, estado `pendiente`/`recibida`; o
  `"canje"` — generada sola desde "Nueva venta" al cobrar con «Mercadería»
  (plan 020, ver "Ventas" arriba): `clienteId`/`cliente` **y además el
  cliente como proveedor** (`proveedor_nombre`/`proveedor_id`, **toda compra
  tiene proveedor**: `createCompra` tira sin él, la UI lo exige también en
  las que suben stock; CHECK `compras_proveedor_obligatorio` pendiente en
  `20261125010000_compras_proveedor_obligatorio.sql`, paso 2, después del
  deploy), `ventaId` referencia esa venta, `estado` nace `"recibida"`
  (el equipo ya está en mano), y `marca`/`imei`/`checklist`/`aclaraciones`
  documentan el equipo recibido — `checklist` es el mismo shape que
  `Ticket.checklistIngreso` de Reparaciones; el celular que entró al
  inventario se linkea desde `Compra.celularId` (resuelto de `Pago.celularId`
  de la venta, no es columna) o, desde que el canje no crea stock, el
  celular con `compra_id` = la compra: lo crea **«Pasar al stock»**
  (`pasarCanjeAlStock` en `lib/db/compras.ts`; la variante se elige recién
  ahí con `CelularFormDialog` precargado vía sus props `inicial`/`textos`;
  costo = `total_usd` de la compra, nunca el del form; suma una fila a
  `compra_items` → aparece en Ingresos y «Eliminar compra» lo puede sacar
  del stock). Filtro «Canjes sin ingresar al stock» en la lista. El detalle
  de una compra `canje` muestra ese bloque ("Información del equipo":
  modelo, IMEI, color, estado, batería, precio, testeo + checklist +
  detalles) y un botón **«Imprimir recibo de canje»**
  (`ReciboImprimir`/`ReciboChecklist` reusados de `components/recibos/recibo`,
  con la firma del cliente y de la empresa que ya trae todo recibo de la
  app) — es el único lugar donde se ve/imprime ese PDF, por eso Ventas solo
  linkea acá (`/compras?open=<id>`, leído con `useSearchParams` igual que el
  `?tab=` de Configuración) en vez de reconstruirlo. Si el medio es "pesos"
  se guarda `montoArs`/`cotizacion` con el dólar del momento (`useDolar()`),
  igual criterio que otros montos en ARS de la app. La tabla `compras` no
  traía una referencia legible como `ventas.numero` — se le agregó
  (`supabase/migrations/20260914000000_compras_numero.sql`), mismo patrón,
  expuesta como `"C-<numero>"`.
- **Cuentas corrientes** (`app/(app)/cuentas-corrientes/`, migrado): saldo
  "fiado" por cliente — cargos suman deuda, pagos la reducen
  (`saldoDe`, extraída a `lib/cuentas-corrientes.ts` puro con test porque el
  client component la necesita para agrupar por cliente y no puede importar
  un módulo `server-only`). Buscador por nombre/teléfono, ficha de cliente
  con el detalle de movimientos, «Registrar pago» directo desde la ficha.
- **Difusión** (`app/(app)/difusion/`, migrado): catálogos armables para
  copiar/pegar en WhatsApp. Las entradas tipo "celular"/"notebook"/"otro"
  son reglas (por condición / por condición / por categoría) que se evalúan
  en el momento contra el stock real (solo `disponible`) — la lógica vive en
  `lib/difusion.ts` (pura, con test): `expandirEntrada` recibe
  `celulares`/`notebooks`/`otros` reales (vía `listCelulares()`/
  `listNotebooks()`/`listOtros()`). El mismo módulo tiene `copyCelular`/
  `copyNotebook`: el texto «para publicar» del botón **📋** de Inventario
  (`components/copiar-texto.tsx`, en cada fila y en el detalle de celulares
  y notebooks; sin costo, IMEI/serie ni notas). `secciones` (estructura anidada con las entradas de
  cada sección del mensaje) se guarda tal cual en el `jsonb` de
  `listas_difusion`, sin mapeo especial. Sin borrado de listas (el original
  tampoco lo tenía).
- **Analíticas** (`app/(app)/analiticas/`, migrado): **solo admin**
  (`requireRole("admin")` en el page + `roles: ["admin"]` en `lib/nav.ts`).
  **Tab + período viven en la URL** (`lib/analiticas-filtros.ts`, con test:
  `parseFiltrosAnaliticas` → `{ tab, preset, desde, hasta }`, defaults
  `tab=ventas`/`preset=mes`; `personalizado` sin fechas válidas → `mes`;
  `desde > hasta` se intercambian). `page.tsx` parsea la URL, calcula el
  rango en hora argentina (`rangoDe` + `presetRange`) y **solo trae y
  calcula lo del tab activo** — al cliente le llegan agregados
  serializables, nunca arrays crudos de la historia.
  **`lib/analiticas-resumen.ts`** (puro, con test) tiene un `resumen*` por
  pestaña (`resumenVentas`, `resumenReparaciones`, `resumenFinanzas`,
  `resumenInventario`, `resumenClientes`, `resumenTurnos`): reciben los datos
  crudos + `ContextoAnaliticas` (`{ rango, rangoAnterior, preset, hoy }`) y
  devuelven el objeto que dibuja la pestaña. El cliente
  (`analiticas-client.tsx`) es solo el shell (selector de período + `Tabs` +
  contexto + `opacity-60` en transición, mismo patrón que Ventas del plan
  007) y un componente por pestaña en `app/(app)/analiticas/tabs/<tab>-tab.tsx`.
  Sin `useDolar()`: Finanzas convierte **solo** con
  `movimientos_caja.cotizacion` (`movimientoEnUsd`); los movimientos ARS sin
  cotización (previos a la columna) no se suman y se informan aparte
  (`sinCotizacion`). Regla: **todo alta de movimiento de caja guarda la
  cotización** (venta con pago ARS, entrega de ticket, compra en pesos,
  movimiento manual ARS); los viejos quedan en `null` a propósito, sin
  backfill.
  Definiciones corregidas: **Margen promedio = `margenPonderado`**
  (ponderado por facturación, `null` → "—" con hint "sin costos cargados"),
  el mismo criterio que "Ganancia por categoría" (`margenPorTipo`). **KPI
  "Cobrado" de Reparaciones** = `cobradoReparaciones` (ingresos de caja con
  `ticket_id` + cargos de `movimientos_cc` con `ticket_id`, fechados al
  cobrar — no `presupuestoUsd` de tickets creados); "Gasto en repuestos" y
  "Ganancia final" salen de los tickets **cobrados**. **Venta promedio por
  día de la semana** grafica `promedioUsd` (÷ cantidad de ocurrencias del
  día), no el total. **Facturación acumulada** respeta el período (con
  "Todas las fechas", agrupado por mes). **Turnos** = historial del período
  (`listTurnosRango`, hasta hoy), no la semana próxima; "Estado de los
  turnos" + **asistencia real** (`atendido` vs `no_vino`, plan 023) y
  "Vencidos sin marcar" = `pendiente|confirmado` con `dayOffset < 0`.
  Gráficos que **no** dependen del período llevan un chip
  `components/analiticas/periodo-chip.tsx` ("Estado actual") en el `sub` del
  `ChartTitle`; Inventario deshabilita el selector de período (solo el
  "Flujo de inventario" filtra). Duplicados quitados: "Ingresos por medio de
  pago" queda **solo en Finanzas**, el treemap de rubros **solo en Ventas**.
  **Minorista vs mayorista** (`ModalidadSplit`, `components/analiticas/modalidad-split.tsx`) sale de `resumenPorModalidad` (`lib/ventas.ts`, con test) sobre `Venta.modalidad` (columna `ventas.modalidad`, se elige en Nueva venta; `MODALIDAD_LABEL`/`MODALIDADES` también viven ahí). "Facturación por vendedor" es ranking `BarRows` (sin límite de colores).
  Colores: rojo/verde solo como estado/signo (`flujo-caja`,
  `waterfall-resultado`, ratio de compras/ventas ≥1×/<1×); series
  categóricas usan `CHART_COLORS`/`CHART_ACCENT` ("Compras vs ventas",
  "Gastos por categoría"). Tab **Clientes** = Customer Intelligence: la
  lógica vive en `lib/clientes-inteligencia.ts` (puro, con test — fuente de
  verdad de las definiciones: operación = venta o ticket, los turnos NO
  cuentan; gasto = `ventas.totalUsd`; procedencia del cliente = la de su
  primera venta con `procedencia`; activo = ≥1 op en 90 días; en riesgo =
  historial y nada en 180; tasa de recurrencia = ≥2 ops sobre ≥1; recurrente
  del lifecycle = ≥3). Foto del estado actual (el filtro de fecha NO aplica
  al tab); `hoy: Date` se pasa del server al client para que SSR e
  hidratación computen lo mismo. Contenido: 4 KPIs (nunca filtrados) + mapa
  de valor + compras vs reparaciones + lifecycle Sankey + cohortes M0-M6 con
  drill-down + ingresos nuevos vs existentes + ranking de canales (click
  filtra los scatters; "Sin dato" gris, nunca un tono de la paleta) + listas
  de atención. Componentes en `components/analiticas/clientes/`; linkeos a
  `/clientes?open=<id>`. `margenPorTipo` (`lib/analiticas.ts`, con test) es
  real desde que `VentaItem` tiene tabla propia (`venta_items`). Helper
  `BarRows`/`BarColumns` (`app/(app)/analiticas/bar-rows.tsx`).
- **Dashboard admin · layout (rediseño estilo sistema-update)**: de arriba abajo `KpisAdmin` (4: ventas destacada sobre `bg-table-header`, ganancia, margen, ticket), `AgendaLocalCard` (`agendaDelLocal` en `lib/dashboard.ts`: listos sin retirar + próximos turnos, bandas con `turnoBlockClass[tipo].banda` + ícono `TURNO_ICONO` (ticket listo: tono de «retira» + `CircleCheck`), `AgendaItem.tipo`; tickets abiertos/turnos hoy pasaron a sus contadores), `ObjetivoMes` (`components/dashboard/objetivo-mes.tsx`, cálculos en `avanceObjetivo`; `ObjetivoPanel` queda solo para la landing), `RitmoChart` + `RubrosPie` y `VentasRecientesTabla`. La página scrollea (ya no entra fija en el viewport). La demo pasa `demo` (sin links a Turnos/Reparaciones).
- **Dashboard · mes** (admin): el selector es un navegador de mes (`‹ Octubre de 2026 ›`, `?mes=YYYY-MM`, `mesDashboard` en `lib/dashboard.ts`; mes pasado = calculado al último día del mes). "Ritmo del mes" (`RitmoChart`, `ritmoDelMes`) reemplazó a "Tendencia de ventas" (`TrendChart` queda solo para el vendedor); hay card "Ganancia del mes" (`margenVenta`). La demo lleva el mes en estado local (`onMesChange`).
- **Dashboard** (`app/(app)/dashboard/`, migrado): **dos dashboards por
  rol, la ramificación vive en el server** (`page.tsx`, ver plan 005) —
  `admin` → `dashboard-admin.tsx`; `vendedor`/`tecnico` →
  `dashboard-empleado.tsx`. Regla de oro: **el filtrado por rol no es CSS ni
  esconder props — al empleado no se le calcula ni se le pasa ganancia,
  margen, `costoUsd` ni el objetivo de facturación de la org** (todo lo que
  viaja en el payload RSC se lee desde DevTools). **El de empleado usa el
  mismo diseño que el de admin** (25/11): `KpisAdmin` con `metricasEmpleado`
  → `AgendaLocalCard` → (vendedor) `RitmoChart` con `target={0}` (sin meta) y
  título «Mi ritmo del mes» + `RubrosPie` + `VentasRecientesTabla`, todo con
  **sus** ventas (`MisVentasDashboard`) → (técnico) `MisTickets`
  (`ticketsDeTecnico`). Siempre el mes en curso, sin navegador de meses.
  "Listos para retirar" es de toda la org. `TrendChart`/`MetricCards`/
  `TurnosHeatmap`/`RecentSales` ya no los usa ningún dashboard de la app. Cálculo en `lib/dashboard.ts` (con tests):
  `metricasDashboard` (5 métricas, `delta` **opcional** — los conteos
  puntuales no van con el chip "+0.0%"; `destacada` = la principal sobre
  `bg-accent` ocupando 2 columnas), `metricasEmpleado` (3 tarjetas iguales para cualquier rol
  empleado: **Mis ventas** destacada con delta, **Turnos hoy** y **Tickets
  abiertos** de todo el local; Vendedor + Técnico ve además sus bloques de
  ventas y de tickets),
  `objetivoDelMes` (`target` = `organizations.objetivo_mes_usd`),
  `ventaGananciaPorPeriodo` (venta/ganancia/**fechas** ISO por día para los
  3 períodos), `ventasPorRubro` (mix del donut `RubrosPie` desde
  `VentaItem.categoria`), `ventasRecientes` (lista clicable → `/ventas?open=`
  con `hace` relativo calculado en el server — `Venta.fechaISO` no tiene
  hora, granularidad por día) y `ticketsEje`/`fmtUsdCompact` en
  `lib/chart.ts` (escala del eje Y contra el máximo "lindo", no el crudo —
  o las marcas mienten). `TrendChart`: barras en reposo `CHART_TRACK`, la
  de hoy en `CHART_COLORS[3]`, eje X con día del mes + mes en la primera
  etiqueta, tooltip con fecha real (`fechaCorta`, ISO parseado con
  `.slice()` + `Date.UTC` — nunca `new Date(iso)`), pill "Prom." al borde
  derecho. **Tiempo real**: `useRefrescoEnVivo` (`components/dashboard/`)
  — evento de la org → `router.refresh()` con debounce de 1,5 s (el emisor
  no recibe su propio evento; para él alcanza el
  `revalidatePath("/dashboard")` que hacen las actions de
  ventas/reparaciones/turnos). Deep links nuevos: `?estado=` en
  Reparaciones (desde el widget Taller, validado contra `TICKET_FLOW`),
  `?open=` en Ventas (desde Ventas recientes, mismo patrón que
  Clientes/Compras) y búsqueda por `#id` de ticket en Reparaciones
  (desde "Mis tickets" del técnico).
- **Configuración** (`app/(app)/configuracion/`, migrado): admin-only salvo
  la pestaña **«Cuenta y negocio»** (`?tab=cuenta-negocio`), que cualquier rol
  ve en su parte «Mi cuenta» (un vendedor/técnico ve la sección titulada «Mi
  cuenta» con una sola tarjeta; el admin ve las dos, lado a lado en `lg`). Los
  valores viejos `?tab=negocio` y `?tab=cuenta` se siguen aceptando como alias
  (`tabDeParam`) por los links de la ayuda, el onboarding y los bookmarks.
  "Usuarios y roles" lista `profiles` reales de la org
  y conecta `inviteMember`/`setMemberRoles` de `lib/auth` — "Invitar usuario"
  y la edición del miembro, ambos validan admin server-side adentro de esas
  funciones. **Varios roles por usuario (plan 029)**: se eligen con
  checkboxes (`CampoRoles`), Admin absorbe al resto, la tabla muestra un chip
  por rol y el error de la RPC («La organización necesita al menos un admin
  activo») se muestra dentro del dialog. **Baja de usuarios**: con historial
  (`HISTORIAL_USUARIO` en `lib/miembros.ts`: las FK a `profiles` sin
  cascada) solo se **desactiva** (`deactivateMember`: ban de Auth +
  `activo = false`) y se deshace con **«Reactivar»** (`reactivateMember`,
  respeta el cupo); sin historial se **elimina** de verdad (`deleteMember`:
  borra el usuario de Auth, el perfil cae por cascada, el email queda libre;
  recuenta el historial en el server). «Invitación pendiente» =
  `Miembro.pendiente` (Auth sin `email_confirmed_at`) → **«Reenviar
  invitación»** (`resendInvite`, `inviteUserByEmail` de nuevo). Qué botón se
  ofrece lo decide `accionesMiembro` (puro, con test); `inviteMember` avisa si
  el email ya es de un usuario de la org. Una FK nueva a `profiles` sin
  cascada se suma a `HISTORIAL_USUARIO`. **El alta ya no pide Instagram**
  (se carga después, editando el miembro o en Mi cuenta). **Instagram** de cada usuario
  (`profiles.instagram`, opcional, **solo texto**: Instagram no tiene API
  pública para buscar cuentas personales): `normalizarInstagram`
  (`lib/instagram.ts`, con test) acepta `@usuario`/link y guarda el nombre en
  minúscula; CHECK espejo en la base. Lo edita el admin (`setMemberInstagram`,
  service role) o cada uno en Mi cuenta (RPC `set_own_instagram`;
  `update_own_profile` no deja vaciar).
  "Datos del negocio" (tarjeta dentro
  de «Cuenta y negocio») es 1:1
  con la organización — no es una tabla aparte, son columnas nuevas en
  `organizations` (`direccion`/`telefono`/`cuit`/`horario`, además del
  `nombre` que ya existía); sin policy de `update` para `authenticated` (a
  propósito), el guardado va por `createServiceRoleClient()` +
  `requireRole("admin")` en `lib/db/configuracion.ts`, mismo criterio que
  `signUp`/`inviteMember`. `MiCuenta` (nombre/alias/email, vía
  `updateOwnProfile`) es la otra tarjeta de la misma pestaña. "Recibos" (`RecibosForm`) es el mismo patrón
  (columnas `garantia_*` en `organizations`, mismo `updateNegocioAction`)
  con preview en vivo del recibo de Garantía al lado del form — ver "Recibos
  / PDFs". "Importar datos" (`importar-datos.tsx`) es un
  alta masiva vía CSV de celulares, notebooks (dedupe por número de serie; `bateria` obligatoria si es usado; la columna `observaciones` va a `Notebook.notas`). La `condicion` de celulares es obligatoria y cerrada a `CONDICIONES_CELULAR` (`lib/status.ts`, misma lista que el alta manual) y clientes **existentes** (no ventas
  históricas — se descartó a propósito para no lidiar con fechas
  retroactivas ni con celulares "vendido" que ya no están en stock): parseo
  y validación con zod puros en `lib/importacion.ts` (con test, sin
  Supabase), dedupe explícito antes de insertar (celulares por IMEI —
  impuesto además por el `UNIQUE (organization_id, imei)` de la tabla;
  clientes por teléfono/email, que no tiene ningún constraint) tanto
  dentro del archivo subido como contra lo ya existente en la org, y un
  solo insert bulk por entidad (`createCelularesBulk`/`createClientesBulk`)
  en vez de un loop llamando a `createCelular`/`createCliente` fila por
  fila. `estado` vacío en el CSV de celulares/notebooks default a
  `disponible` (`ESTADO_IMPORT_DEFAULT`; el alta manual sigue en
  `en_revision`); batería obligatoria en usados, ignorada (100) en `NUEVO`;
  montos aceptan `U$ 1.300` (`normalizarMonto`). La tabla de revisión se
  configura por columna con `COLUMNAS_CELULAR`/`_NOTEBOOK`/`_CLIENTE`
  (`lib/importacion.ts`: título, desplegable, monto `U$`, "no aplica"):
  `estado` va primero, **`varianteId`** (columna virtual «Variante», solo
  celulares: sugerida por `buscarVariante`, obligatoria por fila y reválidada
  contra la org en `importCelularesAction`) va segunda, la validez de la fila
  es un punto junto al número +
  línea de detalle debajo, todo centrado; `completarFila` aplica defaults en
  cada cambio. Admin-only vía `requireRole` en
  `importCelularesAction`/`importClientesAction` — el server revalida cada
  fila con el mismo schema que usa el preview del navegador, nunca confía
  en esa validación client-side. **Leer con IA** (misma pantalla): el admin
  pega texto libre y `leerConIaAction` lo estructura con Claude Haiku 4.5
  (`lib/ia/importacion.ts`, salida estructurada con las columnas de la
  plantilla, las notas de la plantilla son las reglas del prompt); las filas
  vuelven crudas y pasan por el **mismo** preview/`parse*Row`/dedupe que un
  CSV, en una **tabla editable** (`TablaEditable`: cada celda se corrige y el
  estado se recalcula con `evaluarFilas`, pura y con test; filas se pueden
  quitar). Cupo en `lib/ia-lecturas.ts` (puro, con test): **una lectura por
  tipo** (celulares/notebooks/clientes) por org, sin renovación, y 20.000
  caracteres; solo cuenta una lectura exitosa. `organizations.ia_lecturas_ilimitadas` (default `false`, solo service role/SQL lo prende, a pedido) saca el cupo para esa org (`lecturasRestantes(usadas, ilimitadas)` → `Infinity`, la UI dice «Lecturas sin límite»); hoy activo solo para Mundo Phone. Tabla `ia_lecturas` (escribe
  solo service role): guarda tokens y `filas_resultado`, que permite
  «Retomar la lectura con IA» si se recarga antes de importar. Los dos botones
  de la plantilla abren el mismo modal de ayuda (`AyudaPlanillaDialog`):
  «Google Sheets» copia la plantilla como TSV y explica cómo pegarla en A1;
  «CSV» descarga el archivo y explica cómo importarlo. La pestaña de
  `sheets.new` la abre el botón «Abrir planilla» del modal, no el click
  original: el navegador la trae al frente y taparía los pasos (no hay forma
  confiable de abrir una pestaña en el fondo).
- **Cotización del dólar**: `lib/dolar.ts` (`useDolar()` → blue de
  `dolarapi.com`, cache en memoria, fallback `1465`). Se muestra en el
  `Topbar` vía `components/dolar-navbar.tsx`. **No está en Configuración.**
- **Proveedores**: sección eliminada.

### Recibos / PDFs

`components/recibos/recibo.tsx`: `ReciboImprimir` (sin preview -- ver "Sin
modal de preview" abajo) envuelve `ReciboShell`, que arma una o
varias `ReciboHoja` (una por `ReciboPagina` en `paginas`, cada una con
`break-after: page` propio — ver "una o varias hojas" abajo; sin `paginas`
cae al uso de siempre, una sola hoja con `titulo`+`children`). Cada hoja:
banda superior `accent` (título/N°/fecha en blanco; a la derecha el logo
placeholder, o los datos del negocio si `garantia`, ver abajo) → bloque de
identificación del cliente → `children` → firmas (siempre al final, msvia
`mt-auto`) → footer `accent` de una línea ("Documento no válido como
factura…"), con clase `recibo-print-footer` para repetirse en **cada
página física** vía `position: fixed` en `@media print` (`app/globals.css`)
— si una sección no entra en una hoja, el footer no queda pegado solo al
final de todo, sale en cada una. Todo bloque de cuerpo
(`ReciboCampos`/`ReciboLineas`/`ReciboGarantiaItems`/`ReciboChecklist`/
`ReciboNota`/`ReciboNotaLista`) lleva `print:break-inside-avoid-page`: si no
entra completo en lo que queda de una hoja, pasa entero a la siguiente en
vez de cortarse a la mitad.

Bloque de identificación del cliente, dos variantes (prop `compacto` de
`ReciboPagina`, o top-level en `ReciboImprimir`/`ReciboShell` para el uso de
una sola hoja sin `paginas`): **normal** — "Datos de facturación" con dos
tarjetas "Facturado por" (negocio real, `nombre`/`direccion`/`cuit`/
`telefono`) / "Facturado a" (`cliente` + `ReciboClienteContacto`: teléfono/
email del cliente si `ReciboImprimir` los recibe, `null` si no hay dato).
**`compacto`** (Ventas → Garantía, Reparaciones → Ticket de ingreso) — el
negocio pasa a la banda superior (reemplaza el logo placeholder) y el
cliente queda en una sola tarjeta "Información cliente"; `sello` (prop
aparte, `ReciboSelloTipo`) agrega `ReciboSello` (insignia rotada,
`position: absolute` sobre la tarjeta del cliente, no ocupa fila propia).
**Todo documento lleva su sello** (`SELLOS` en `components/recibos/recibo.tsx`,
ícono + texto + lado, alternando para que no se vean iguales al imprimir
juntos): Garantía (derecha), Recibo de venta (izquierda), Ticket de ingreso
(derecha), Ticket de egreso (izquierda), Presupuesto (derecha) y Recibo de
canje (izquierda); el de la derecha gira a la derecha y el de la izquierda, a
la izquierda. Un documento nuevo suma su tipo a `SELLOS`.

Helpers para el cuerpo: `ReciboCampos` (pares clave/valor -- `variant="inline"`
para "Label: valor" compacto en vez de la grilla de dos columnas cuando el
valor es corto y deja mucho hueco, ver "Información del equipo" de
Reparaciones; `separadores` agrega línea fina entre filas), `ReciboLineas`
(tabla con total en un bloque aparte, no una fila más — columnas dinámicas
según lo que traiga cada línea: `serial` agrega Serial, `garantia` agrega
Garantía -- Producto y Precio siempre, Cantidad en cuanto hay alguna columna
extra; si ninguna línea trae nada y no se fuerza con `forzarTabla`, queda el
formato compacto "2× Detalle"), `ReciboGarantiaItems`
(tabla Ítem/Serial/Garantía, sin Precio — no es relevante en un documento de
garantía — y sin fila de total), `ReciboChecklist` (grilla ítem+estado de
un checklist de Reparaciones, ver esa sección, + color al pie) y su
variante `ReciboChecklistComparado` (tabla ítem/Ingreso/Egreso, los dos
checklists de un ticket lado a lado -- solo en Presupuesto), y
`ReciboNota`/`ReciboNotaLista` (título centrado violeta + línea, sin
caja — mismo patrón que el resto de títulos de sección; `tono="warning"`
rompe el patrón a propósito con un recuadro rojo claro para que resalte,
pensado para ir al final del documento, ver "Importante" de Garantía).
Todos devuelven `null` si el texto está vacío, en vez de un bloque vacío.
Los headers de tabla salen con la banda índigo oscuro global
(`app/globals.css`, `th`) sin pedirlo aparte. La impresión se aísla con
`@media print`: se oculta todo salvo `.recibo-print`.

Usos: Reparaciones → **Ticket de ingreso**/**Ticket de egreso**/
**Presupuesto** (ver esa sección), Compras → **Recibo de canje** (solo
compras `origen: "canje"`, ver esa sección), Ventas → comprobante de venta y
**Garantía** (venta completa o un solo ítem, botón propio en
Ventas y en cada fila de "Ítems vendidos" — ya no depende de que el ítem
tenga `celularId`; el ítem sin `celularId` sale con "—" en la columna
Garantía). El membrete (nombre/dirección/CUIT/teléfono) toma `negocio` real
(`lib/db/configuracion.ts` → `getNegocio()`) pasado como prop desde cada
`page.tsx` hasta `ReciboImprimir` — el import de `lib/mock-data.ts` que queda
en el archivo es solo el valor por default del prop, nunca se usa (todas las
páginas siempre lo pasan). El teléfono/email del cliente (`clienteTelefono`/
`clienteEmail` en `ReciboImprimir`) se resuelve en cada client component
contra `ClienteOpcion` (por `clienteId`), no viaja en `Venta`/`Ticket`.

**Sin modal de preview**: el ícono/botón de cada documento (Ticket de
ingreso, Garantía, Recibo de canje, etc.) manda directo al diálogo nativo
de imprimir/guardar PDF del navegador — no hay paso intermedio de preview
en un `Dialog`. El estado que dispara cada documento (`recibo`/`open` en
cada `*-client.tsx`) sigue siendo un simple booleano/objeto-o-null, sin
cambios ahí: lo que cambió es que `ReciboImprimir` ya no envuelve un
`Dialog` — arma el recibo directo en `#recibo-print-root` (portal a
`document.body`, mismo mecanismo de aislamiento de impresión de
`app/globals.css` que ya existía) y, en un `useEffect` sobre `open`, espera
a que las imágenes del recibo (el logo del negocio) terminen de cargar —
con un timeout de seguridad (`ESPERA_MAXIMA_IMAGENES_MS`, 2s) por si alguna
nunca resuelve — antes de llamar a `window.print()`. Al cerrarse ese
diálogo nativo (evento `afterprint`, se dispare imprimiendo o cancelando)
llama a `onClose()` para volver el estado a `null`/`false`, listo para el
próximo click.

Textos editables de garantía (`Negocio.garantiaTexto/garantiaCondiciones/
garantiaImportante/garantiaCausales`, columnas nuevas en `organizations`,
sin policy de `update` para `authenticated` -- mismo criterio que el resto
de "Datos del negocio", se guarda por `service role` + `requireRole("admin")`
en `updateNegocio`) y `Negocio.reparacionTerminosIngreso/
reparacionTerminosPresupuesto/reparacionTerminosEgreso` (mismo criterio, un
texto por documento de Reparaciones, no uno compartido) más
`Negocio.reparacionAclaracionesIngreso` (mismo criterio, espacio libre al
final del **Ticket de ingreso** para aclaraciones propias del negocio,
separado de los términos y condiciones de ese mismo documento): se editan en
Configuración → **Recibos** (`RecibosForm` en `configuracion-client.tsx`),
con preview en vivo del lado de Garantía — el mismo `ReciboShell`/
`ReciboGarantiaItems`/`ReciboNota` renderizado al lado del form, atado al
`form` state (no al `negocio` guardado) para que el cambio se vea antes de
guardar (los 3 campos de Reparaciones no tienen preview propio, solo el
campo de texto). El recibo de canje no tiene textos editables acá a
propósito -- sus "Aclaraciones" son libres por canje, cargadas en
`CanjeModal` al momento de la venta (ver "Ventas"), no un texto fijo del
negocio.

## Notificaciones en tiempo real

Split en dos módulos -- **no juntarlos de nuevo**:

- `lib/realtime.ts`: solo tipos + presentación, sin transporte. `AppEvent`
  (unión: `sale_confirmed`, `ticket_ready`, `repair_approved`,
  `appointment_arrived`, `appointment_scheduled`, `low_stock` -- agregar un
  tipo nuevo = extender la unión **y** el `switch` de `describe()`) y
  `describe(e)` → `ToastView`. No toca `window`, seguro de importar desde
  cualquier lado.
- `components/notifications/realtime-provider.tsx`: el transporte.
  `RealtimeProvider({ organizationId, children })` (montado en
  `app/(app)/layout.tsx` con `user.organizationId`) + hook `useRealtime()` →
  `{ publish, subscribe, transport }`. El canal es **`crm-events:<organizationId>`**,
  no uno global -- sin esto, cualquier evento de una organización se vería
  en todas las demás (bug real que hubo y se arregló). Transporte: si hay
  `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Supabase
  Realtime Broadcast; si no → `BroadcastChannel` nativo (cross-tab, mismo
  browser). El emisor **no** recibe su propio evento (son "acciones de otros").

Quien dispara un evento (`publish(...)` desde un client component, después
de que la server action confirmó) arma `actor` con el usuario real de la
sesión -- `` `${user.nombre} (${rolLabel[user.rol].toLowerCase()})` `` (ver
`turnos-client.tsx`/`reparaciones-client.tsx`) o el dato real del registro
cuando corresponde (Ventas usa `venta.vendedor`). **Nunca hardcodear un
nombre de actor** -- eso fue un bug real que quedó de la época mock.

- `components/notifications/bell.tsx` (`NotificationsBell`, en el `Topbar`)
  se suscribe vía `useRealtime()`: guarda las últimas ~15 notificaciones con
  timestamp y las muestra en un dropdown al tocar la campanita, con contador
  de no leídas. Es en memoria del navegador -- se pierde al recargar, no hay
  tabla de notificaciones persistida.
- De los 6 tipos de `AppEvent`, `low_stock` lo dispara **Variantes de
  celulares** (plan 024): cuando una variante **cruza** su `stock_minimo`
  hacia abajo (`cruzoMinimo` en `lib/variantes.ts`), desde el client después
  de que la action confirmó — en Nueva venta (unidades vendidas por variante)
  y en Inventario (cambio de estado / baja de una unidad). `part` =
  `nombreVariante(...)`, `qty` = disponibles resultantes.

## Qué NO hacer

- No importar `@supabase/*` fuera de `lib/auth/supabase.ts` — todo lo demás
  pasa por `lib/auth` (sesión) o `lib/db/<dominio>` (datos).
- No exponer `SUPABASE_SERVICE_ROLE_KEY` al cliente (nunca con prefijo
  `NEXT_PUBLIC_`, nunca en un componente `"use client"`).
- No crear una tabla sin RLS, sin las 4 policies `to authenticated
  (organization_id = current_user_org_id())`, o sin `DEFAULT
  current_user_org_id()` en `organization_id` — ver "Backend y
  multi-tenancy" para por qué cada una de las tres es necesaria.
- No llamar `publish(...)` desde `lib/db/*` ni desde un `actions.ts` (necesita
  `window`) — siempre desde el client component, después de que la mutación
  confirmó.
- No reintroducir formatos de moneda distintos a `fmtUsd`.
- No duplicar cards de stats, títulos de gráfico ni badges de estado: usar
  `StatCard`, `ChartTitle`, `Badge`.
- No usar los indicadores nativos (flechas de incremento/decremento) de los
  `<input type="number">` — quedan feos en montos, batería, cantidades, etc.
  Ya están ocultos globalmente en `app/globals.css`; no reintroducirlos.
- No usar `<input type="date">` a mano: muestra el formato del idioma del
  navegador (MM/DD/AAAA en inglés). Las fechas van siempre en **DD/MM/AAAA**
  con `InputFecha` (`components/ui/input-fecha.tsx`, valor en ISO).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
