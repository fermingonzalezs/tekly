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

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind 3 · `lucide-react`.
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
lib/status.ts             estados (tickets, equipos, turnos, pagos) + tonos
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
**sin `offers`** mientras los precios de la landing sean provisorios.

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
- `profiles (id → auth.users, organization_id, rol, nombre, alias, email,
  activo)` — una fila por usuario. **Un usuario pertenece a una sola
  organización** (no hay tabla de membresías N:M; si hiciera falta multi-org
  el día de mañana, es una migración de datos acotada).
- Una tabla por dominio de negocio (`clientes`, `equipos`, `repuestos`,
  `otros_items`, `movimientos_stock`, `proveedores`, `tickets`, `servicios`,
  `turnos`, `ventas`, `venta_items`, `cajas`, `movimientos_caja`,
  `conciliaciones`, `movimientos_cc`, `compras`, `listas_difusion`), todas
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
  cascade`, mismas 4 policies de RLS + `DEFAULT current_user_org_id()` que
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
tienen policy de `select` — altas y cambios de rol van por `service role`
(signup/invite) o por las RPC `update_own_profile`/`set_member_role`
(`security definer`, cada una valida `auth.uid()`/rol adentro).

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
`updateOwnProfile`/`setMemberRole`), `validation.ts` (schemas de `zod` para
los forms de auth).

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
de la request). Cambios acá requieren reiniciar `npm run dev`.

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
"Backend y multi-tenancy") — mismo rubro Equipos/Reparaciones/Accesorios/
Otros que `ventasPorRubro` del dashboard (`categoriaDe`/`RUBRO_LABEL`
compartidos vía `lib/ventas.ts`), agregando `costoUsd`/`precioUsd` por ítem;
un ítem sin `costoUsd` cargado cuenta como operación pero no entra en el
cálculo de margen.

### Qué falta antes de producción

- **SMTP propio para Auth** (Resend/Postmark) — el email service default de
  Supabase no es apto para volumen real de usuarios (rate limit muy bajo).
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

## Sistema de diseño

Referencia visual: "Cocos CRM" — limpio, mucho whitespace, esquinas
redondeadas, paleta neutra + un acento **índigo**.

### Marca: logos de Tekly (`public/tekly-logo-kit/`)

Kit de logo de la **plataforma** (ícono = T blanca sobre un globo de líneas,
fondo índigo `#4f49bd`; nombre "Tekly" en Bricolage Grotesque 700, ya
convertido a trazos: no hace falta la fuente). El detalle del paquete está
en `public/tekly-logo-kit/LEEME.md`; `public/tekly-logo-kit.zip` es solo el
paquete original (no se referencia desde la app).

**Siempre se usa vía `<TeklyLogo variante="…" altura={px} />`**
(`components/brand/tekly-logo.tsx`): un solo lugar con las rutas y las
proporciones; no hardcodear `/tekly-logo-kit/…` en los componentes. `alt=""`
cuando el link/botón que lo contiene ya tiene `aria-label`.

| Archivo (SVG en `public/tekly-logo-kit/`) | Variante | Dónde va |
|---|---|---|
| `tekly-isologo-horizontal.svg` | `horizontal` | Header y footer de la landing (`components/marketing/nav.tsx`, `footer.tsx`); header del drawer móvil del sistema (`components/mobile-nav-drawer.tsx`). Solo sobre fondo claro. |
| `tekly-icono.svg` | `icono` | Marca chica: panel de plataforma (`app/admin/layout.tsx`); maqueta borrosa del login (`components/auth/app-preview-backdrop.tsx`). También avatar/redes. |
| `tekly-icono-invertido.svg` | `icono-invertido` | Encabezado índigo de las pantallas de auth (`components/auth/auth-modal.tsx`: login, signup, olvidé/restablecer contraseña) y header del sistema (`components/topnav.tsx`) cuando la organización no cargó su propio logo (**prueba**: sobre el header blanco el tile desaparece y queda la T índigo con el globo en línea fina; si se prefiere el tile sólido, volver a `icono`). Para cualquier fondo índigo u oscuro. |
| `tekly-isologo-horizontal-blanco.svg` | `horizontal-blanco` | **Sin uso todavía.** Isologo con texto blanco y fondo transparente, para fondos índigo/oscuros (ej. el banner de cierre de la landing si se quiere marca ahí). |
| `tekly-isologo-horizontal-sobre-indigo.svg` | `horizontal-sobre-indigo` | **Sin uso todavía.** Isologo con el fondo índigo incluido. |
| `tekly-isologo-vertical.svg` | `vertical` | **Sin uso todavía.** Pensado para login/splash; hoy el login ya lleva el ícono en el header de la card, así que no se agregó un segundo logo. |
| `tekly-wordmark.svg` | `wordmark` | **Sin uso todavía.** Solo el nombre. |
| `tekly-favicon-32.svg` / `-16.svg` | — | Favicon SVG (`icons.icon` en `app/layout.tsx`). |
| `favicon.ico` (16 y 32 px) | — | Copiado a `public/favicon.ico`; es el favicon de respaldo. |
| `png/tekly-icono-180.png` | — | `apple-touch-icon` (`icons.apple` en `app/layout.tsx`). |
| `png/tekly-icono-192.png`, `-512.png` | — | **Sin uso todavía:** reservados para un `manifest` PWA (no hay). |
| `png/tekly-favicon-16/32.png`, `png/tekly-isologo-*.png` | — | PNG de respaldo (isologos a 3x) para donde no sirva SVG (mails, redes, documentos). |

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
`lib/status.ts` (`ticketStatus`, `equipoStatus`, `repuestoEstado`,
`turnoStatus`, `turnoTipo`, `medioPago`, `otroCategoria`) — todos devuelven
`{ label, tone }`, `tone ∈ blue | amber | green | gray | red | violet`, con su
color asociado ya resuelto en `dotClass`.

En **listas/tablas** (columna de estado, medio de pago, categoría, tipo) el
patrón es un chip gris neutro (`bg-neutral-100 text-neutral-700 rounded-md
px-2 py-0.5 text-xs`) con un punto `dotClass[tone]` (`h-1.5 w-1.5 rounded-full`)
al lado del label — el color vive en el punto, no en el fondo del chip. Ya lo
usan Ventas (Pago), Reparaciones (Estado), Inventario (Estado de
equipos/repuestos, Categoría de "Otros") y Turnos (tipo/estado). Para una
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
- **Filas cebra**: `tr` par en índigo muy claro (`#f0eff9`), impar blanca.
  Regla en `@layer base` para que el `hover:bg-*` de cada fila siga ganando.
  Los `.recibo-print` tienen su propia cebra, en violeta claro (`#edecf8`,
  `accent-soft`) en vez del índigo muy claro del resto de la app.
- **Todo alineado a la izquierda** por defecto (`th, td { text-align:left }`).
- **Opt-out por celda**: `text-end` / `text-right` alinea a la derecha
  (columnas de plata / números: `Monto`, `Total`, `Precio`, `Costo`, `Margen`);
  `text-center` centra (ej. celda vacía "sin resultados"). `text-start` sigue.
- Números en columnas → `tabular-nums`. Texto de las celdas: peso normal (dejar
  `font-semibold` solo para el dato que tiene que destacar, ej. Total).
- Fuera de tablas, alinear a la izquierda con `text-start`.
- **Decisión tomada (plan 007): texto a la izquierda, montos a la
  derecha.** Ventas es la sección de referencia — código/estado corto a la
  izquierda, plata/% a la derecha (`text-right tabular-nums`), acciones en
  columna angosta a la derecha (`w-px whitespace-nowrap`). Las otras 9
  secciones que hoy centran todas sus columnas (Cajas, Inventario, Recuentos,
  Compras, Reparaciones, Clientes, Configuración, Cuentas corrientes,
  Difusión) se migran a este criterio después (plan aparte) — no copiar el
  patrón centrado solo porque es mayoritario hoy.

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
4. **Filtros** — una sola fila (`BarraFiltros`): tabs (de *entidad* y de
   *vista de la misma entidad*) · buscador · selects · acción primaria a la
   derecha. Los tabs van siempre visibles (`BarraFiltros.tabs`); en mobile
   solo los selects se colapsan detrás de "Filtros · N".
5. **Tabla** (con `Pagination` si es server-paginada).

Los tabs (Inventario Equipos/Repuestos/Otros, Cajas
Movimientos/Conciliaciones/Cajas, Recuentos Recuentos/Movimientos, Ventas
Ventas/Ítems vendidos, Reparaciones Tickets/Servicios) van todos en la fila de
filtros, con el resto de los filtros de la sección — no arriba de los
gráficos.

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
| `Dialog` | `components/ui/dialog.tsx` | `{ open, onClose, title, description?, footer?, size: md \| lg \| xl \| 2xl \| 3xl \| 4xl }` (anchos `max-w-md/2xl/3xl/4xl/5xl/6xl`; **modal que se acerca a 100vh → ensancharlo y partirlo en columnas en `lg:`**, no alargarlo: Nuevo ticket, Entregar equipo, Nueva venta (`4xl`, 2 columnas), canje, Nueva compra, alta de equipo/repuesto/producto en `3xl`; detalles en `2xl`; `ChecklistEditor` acepta `gridClassName`) — **vidrio único** (plan 011): header oscuro `table-header` con texto blanco, panel traslúcido (`bg-white/80`; `xl`/`2xl` → `bg-white/90`), `border-accent/70`, overlay `bg-neutral-900/[0.07] backdrop-blur-[2px]` (anidado: sin segundo blur). Centrado vertical, scroll propio, `createPortal` a `<body>`, cierra con Esc / click fuera, `role="dialog" aria-modal`. Los campos dentro del body se re-estilan a 42px/radio 14px/blanco 70%. Para resetear el estado interno al reabrir: `key={abierto ? "a" : "b"}` en el uso |
| `Tabs` | `components/ui/tabs.tsx` | `{ value, onChange, options: [{ value, label, count? }], accent? }` — `accent` (hex) para teñir el estado activo con otro color; por defecto usa `accent` |
| `Pagination` | `components/ui/pagination.tsx` | `{ page, total, pageSize?, onPageChange, className? }` — "Mostrando 1–50 de N" + números de página (‹ Anterior · 1 2 3 … N · Siguiente ›), se oculta con una sola página. `paginasVisibles` (helper puro, con test) en `lib/pagination.ts`; `PAGE_SIZE = 50` |
| `SeccionTabla` | `components/ui/seccion-tabla.tsx` | Layout estándar de una sección con tabla (ver "Layout estándar de sección con tabla"): fija el orden tabs → visibilidad → gráficos → tarjetas → filtros → tabla. `{ id, tabs?, graficos?, tarjetas?, columnasTarjetas? (4\|5\|8), filtros?, children }` |
| `GraficoCard` | `components/ui/grafico-card.tsx` | Contenedor de un gráfico de sección: `Card` con alto fijo `h-72` desde `sm`, encabezado `ChartTitle align="left" divider` y cuerpo `flex-1`. **Todo gráfico de una sección con tabla va adentro** — ninguno define su propia altura. `{ title, sub?, action?, children }` |
| `BarraFiltros` | `components/ui/barra-filtros.tsx` | Fila de filtros estándar: tabs de vista → buscador → selects → chips → acción (`ml-auto`), con colapso mobile "Filtros · N". `{ tabs?, busqueda?, filtros?, chips?, accion?, contadorFiltros? }` |
| `useVisibilidadBloques` | `components/ui/use-visibilidad-bloques.ts` | Hook `{ graficos, tarjetas, toggle }` que persiste la visibilidad de los bloques en `localStorage` (`tekly:ui:<id>`). Lógica pura testeable en `lib/visibilidad-bloques.ts`; visible en SSR/primer render para no romper la hidratación |
| Gráficos genéricos | `components/seccion/graficos.tsx` | `GraficoBarrasVerticales`, `GraficoRanking` (con `suffix`), `GraficoDona` y `GraficoBarrasAgrupadas` — cada uno ya envuelto en `GraficoCard` y con empty state. Reusar antes de crear un gráfico nuevo |
| `Field` / `Input` / `Select` / `Textarea` / `Label` | `components/ui/field.tsx` | inputs con estilo consistente; `Field` = `Label` + control |
| `ClientePicker` | `components/ui/cliente-picker.tsx` | `{ clientes: ClienteOpcion[], value: ClienteSeleccion \| null, onChange, allowLibre?, placeholder?, className? }` — desplegable con buscador para elegir cliente. **Usar SIEMPRE este en vez de un `<Select>`/`Input` a mano** en cualquier form que necesite un cliente (Ventas, Reparaciones, Cuentas corrientes, Turnos son los 4 casos hoy). `ClienteSeleccion` (`lib/types.ts`) = `{tipo:"existente",id,nombre} \| {tipo:"nuevo",nombre,telefono?} \| {tipo:"libre",nombre}`. La creación queda **diferida**: elegir "Crear cliente nuevo" solo arma el borrador, recién se persiste (`resolveCliente` en `lib/db/clientes.ts`) cuando la action del formulario confirma — cancelar el diálogo no deja un cliente fantasma. `allowLibre` agrega "usar sin registrar" (`tipo:"libre"`, sin fila en `clientes`) — solo Turnos lo usa (`Turno.clienteId` es nullable a propósito, para turnos de gente que aún no es cliente registrado); las acciones que sí requieren un cliente real (`createVentaAction`/`createTicketAction`/`createMovimientoCCAction`) tipan su input como `Exclude<ClienteSeleccion, {tipo:"libre"}>` y llaman `resolveCliente`. Comparte `useOutsideClick` (`components/ui/use-outside-click.ts`) con el buscador de ítems de Nueva venta (`ItemBuscador`, en `ventas-client.tsx`, que sigue siendo su propio combobox porque busca sobre equipos/repuestos/otros/servicios, no clientes; el plan 007 le agregó flechas/Enter/Esc y devolver el foco al buscador tras agregar). |

### Estados de elementos interactivos

`Button` es el único primitivo con los 4 estados completos: `hover`/`active`
por variante, `focus-visible:ring-2 ring-accent/40` (global, no lo pisa un
`className` custom sin querer) y `disabled:opacity-50 pointer-events-none`.
`Input`/`Select`/`Textarea` (`lib/field.tsx`) tienen `focus:border-accent` y
`disabled:bg-neutral-50 disabled:text-neutral-400`, pero **sin** estado de
error propio (ningún borde/texto rojo de validación) — replicar ese mismo
patrón (`border-accent` en foco) si se agrega uno, no inventar un tercer
estilo de borde. **Loading** hoy es a nivel de ruta (`app/(app)/loading.tsx`,
`Loader2` girando) vía la convención de Next, no por-botón — no hay un
`<Button loading>` con spinner interno; si una acción puntual lo necesita,
seguir ese mismo ícono (`Loader2` de `lucide-react` + `animate-spin`) en vez
de uno nuevo. **Empty states** son ad hoc por tabla (fila con celda
`text-center`, texto tipo "Sin resultados") — no hay componente
`EmptyState` compartido todavía.

### `Dialog`: footer con el sistema único de botones

El footer de **todos** los dialogs usa el mismo primitivo `Button`:
`variant="outline"` para «Cancelar»/«Cerrar» y `variant="primary"` para la
acción principal (`danger`/`danger-outline` para destructivos, `tonal` para
acciones extra en secciones que no tienen acción primaria). `fullOnMobile`
para que en mobile ocupe el ancho. El header es siempre el oscuro del vidrio
(ya no hay `accent`/blanco, plan 011).

Body: `<div className="space-y-3">` con `Field` + `Input` / `Select` /
`Textarea` apilados (pares cortos → `grid grid-cols-1 gap-3.5
sm:grid-cols-2`, campos largos con `sm:col-span-2`); un flag
booleano tipo "activo" va como checkbox debajo de los campos, **dentro del
dialog** — no como botón aparte en la fila de la tabla (`ServicioDialog`,
"Servicio activo", es la referencia). Título: `id ? "Editar X" : "Nuevo X"`.
Para elegir entre opciones dentro de un form usar **`Select`**, nunca
`Tabs` — `Tabs` es el pill de navegación/filtro de página (Del
día/Historial, Equipos/Repuestos/Otros), no un control de formulario.

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
   crédito") 💳, `canje` ("Mercadería") 📦 — label/tone/emoji centralizados
   en `medioPago` (`lib/status.ts`), nunca hardcodeados. Los internos
   (`"pesos"`, `"tarjeta"`, `"canje"`, …) no cambian aunque el label sí —
   son el valor persistido en `cajas`/`movimientos_caja`/`compras`
   (`MEDIOS_CAJA` en `lib/status.ts`, fuente única para esos 3 selectores +
   Turnos). Solo `Pago.medio` (ventas) admite un 7mo valor,
   `"cuenta_corriente"` 📒 (tipo `MedioPagoVenta`, `MEDIOS_VENTA` con los 7)
   — nunca es medio de una `Caja` real. `Venta.pagos` es `Pago[]` = `{
   medio, montoUsd, caja, cajaId?, recargoPct?, compraId? }[]` (1+ medios,
   pago dividido; la suma de `montoUsd` cubre `totalUsd`, sin importar el
   recargo — ver abajo). `compraId` solo aplica a un pago `canje`: elegir la
   caja de canje como destino abre `CanjeModal` (mismo archivo) para cargar
   el equipo recibido + un checklist de ingreso (`ChecklistEditor`,
   `components/ui/checklist-editor.tsx` — compartido con Reparaciones, ver
   esa sección) + aclaraciones libres; al confirmar la venta,
   `createVenta` (`lib/db/ventas.ts`) crea una `Compra` con
   `origen: "canje"` (ver "Compras" más abajo) y guarda su `id` como
   `compraId` en el pago — el detalle completo vive ahí, no en `Venta.pagos`.
   Formularios → `Dialog` + `Field`.
   El modal de **Nueva venta** (`app/(app)/ventas/ventas-client.tsx`) es la
   referencia de form completo: eyebrows en mayúscula, cliente existente/
   nuevo, ítems desde el stock (`equipos`) o libres, y pago dividido con
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

- **Turnos** (`app/(app)/turnos/`, migrado): calendario de los **próximos 7
  días** (columnas) × **09–20 h** (filas). `Turno.dayOffset` (0 = hoy) es
  calculado por `lib/db/turnos.ts` a partir de la `fecha`/`hora` reales de la
  tabla (no persistido) — el contrato del tipo hacia el client component no
  cambió. El color del bloque = `turnoTipo[t.tipo]` (`compra` / `deja` /
  `retira` / `cotizar`). Click en bloque → detalle (+ «Cliente llegó» dispara
  `appointment_arrived`); click en hueco → agendar. Agendar con equipos
  vinculados actualiza `equipos.estado` (`retira` → vendido, resto →
  reservado), igual criterio que Ventas. `Turno.clienteId` (columna
  `cliente_id`, ya existía en la tabla desde el schema inicial, sin
  usarse) es nullable a propósito: el `ClientePicker` de "Agendar turno"
  tiene `allowLibre`, para turnos de alguien que todavía no está
  registrado como cliente — en ese caso `clienteId` queda `null` y
  `cliente` (el nombre, siempre se completa) es lo único que hay.
- **Inventario** (`app/(app)/inventario/`, migrado): 3 tabs — **Equipos**
  (unidades únicas por IMEI, con `Equipo.almacenamiento`), **Repuestos**
  (stock por modelo) y **Otros** (`OtroItem`: iPad, AirPods, tablets,
  accesorios; con `cantidad`). Repuestos y Otros tienen **Recuento** (edición
  inline de stock/cantidad + guardar) e **Ingreso** (dialog que suma unidades
  a un ítem existente con cantidad + precio compra, o crea uno nuevo).
  Equipos tiene «Agregar equipo». **Click en una fila de Equipos** abre
  `EquipoFormDialog` (ver + editar todos los campos, incl. `estado`); el
  mismo dialog con `equipo={null}` es el de alta. Los botones de acción van
  en una toolbar sobre la tabla (`ml-auto`), no en el header.
  `Repuesto.proveedor` es texto libre en la UI pero FK a `proveedores` en la
  base — `lib/db/inventario.ts` resuelve "buscar o crear por nombre". Cada
  alta/edición/recuento/ingreso deja un registro en `movimientos_stock`
  (historial por ítem, antes hardcodeado en el mock).
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
  cantidad` de todos los ítems. Ticket de ingreso/egreso muestran una sola
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
  `cliente ilike` e ítems (`venta_items.detalle` + `equipos.imei`, tope 500
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
  **Alineación**: texto a la izquierda, montos/% a la derecha (`text-right
  tabular-nums`), acciones al final en columna angosta — Ventas es la
  sección de referencia (ver "Reglas globales de tablas").
  La lista es una tabla (`VentaCardMobile` debajo de `md`) con Venta
  (`V-1042` + fecha), Cliente, Detalle, Pago (**un solo chip**: el medio de
  mayor `montoUsd` + "+N", `title` con el detalle vía `montoPagoLabel`),
  Margen (solo `puedeVerCosto`) y Total; los headers Venta/Total/Margen son
  ordenables. Se sacó la columna Costo de la lista (queda en el detalle).
  El detalle (`VentaDetalle`) tiene footer de **3 botones** (Eliminar
  admin, Cerrar y un menú **«Imprimir ▾»** con Comprobante/Garantía,
  navegable con flechas); "Ver compra de canje" pasó al bloque de pagos; el
  viejo "Resumen financiero" se parte en **Pagos** (una fila por pago: chip
  de medio + caja + monto, recargo/cotización, link de canje, total cobrado)
  y **Rentabilidad** (Costo/Ganancia/Margen en 3 `StatCard`, solo
  `puedeVerCosto`). "Ítems vendidos" es una query paginada aparte
  (`listItemsVendidosPagina`, `venta_items` con `ventas!inner`) con 1 fila
  por ítem (Venta/Cliente/Ítem/Serie/Precio/Margen) y abre el mismo
  `VentaDetalle`. También hay ícono de Garantía en la columna Acciones de
  Ventas y de "Ítems vendidos" — mismo documento, mismo
  `garantiaContenido(items)` en `ventas-client.tsx`.
  `VentaItem.costoUsd?` y
  `Venta.procedencia?` existen; el costo NO se edita en el modal de
  alta. **Margen**: `margenVenta(items)` (`lib/ventas.ts`, con test) es la
  única fuente del costo/ganancia/margen de una venta — solo ítems con
  `costoUsd` cargado (mismo criterio que `margenPorTipo` en Analíticas);
  venta sin ningún costo → "—" en tabla/detalle (sin dato, no 100 %). El KPI
  "Margen promedio" usa `margenPonderado(ventas)` (ponderado por
  facturación, `null` → "—" con hint "sin costos cargados") — nunca el
  promedio simple de `margenPct`. La columna `margen_pct` se persiste con
  el mismo criterio (`margenVenta(...) ?? 0`) y se recalculó histórica en
  `20261004140000_ventas_recalcular_margen.sql` (solo margen: la cotización
  de pagos en pesos de ventas anteriores NO se reconstruyó); la UI no la lee para
  mostrar margen (calcula desde los ítems). Vender un ítem con `equipoId`
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
  **Vendedor de la venta**: un vendedor/técnico registra siempre a su
  propio nombre — `createVentaAction` ignora lo que venga del cliente y
  fuerza `user.id`/`user.nombre` si `rol !== "admin"`; la UI lo refleja
  (campo Vendedor como texto fijo con el look de input deshabilitado,
  `NuevaVentaDialog` recibe `user`). Solo el admin elige (`Select` que
  arranca en sí mismo; `listVendedores` incluye a los admin).
  `VentaItem.categoria`
  (`"equipo" | "servicio" | "otro" | "libre"`) guarda el `origen` con el que
  se agregó el ítem en el modal -- alimenta `ventasPorRubro` de
  `lib/dashboard.ts` (ver Dashboard abajo) y `margenPorTipo` de
  `lib/analiticas.ts` (ver Analíticas abajo), vía el `categoriaDe`/
  `RUBRO_LABEL` compartido en `lib/ventas.ts`; es opcional porque ventas
  creadas antes de este campo no lo tienen. Persistencia: tabla propia
  `venta_items` (ver "Backend y multi-tenancy"), no `jsonb` en `ventas`.
  «Eliminar venta» (admin-only) abre un `ConfirmDialog` con hasta 5
  checkboxes independientes, cada uno visible solo si aplica: devolver los
  equipos vendidos a `disponible`, devolver los repuestos usados al stock,
  borrar el/los movimiento(s) de caja generados, borrar el movimiento de
  cuenta corriente generado (ver "Medios de pago" arriba), borrar la
  `Compra` de canje generada — `deleteVenta` (`lib/db/ventas.ts`) recibe
  los 5 como un objeto de opciones. La fila se saca de la lista recién
  cuando la action confirmó (si falla, el error se muestra dentro del
  `ConfirmDialog` y la venta no "desaparece"); `createVenta` compensa una
  falla a mitad con ese mismo `deleteVenta` (todo en `true`) para no dejar
  ventas/equipos/movimientos a medias — no es una transacción real,
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
  moneda: "usd" | "ars", activa, descripcion, creadaEl, medioPago }` — puede
  haber varias por moneda (Mostrador/Taller en ARS, Caja USD/Bóveda USD en
  USD) y varias cajas pueden compartir el mismo `medioPago` (ej. Mostrador y
  Taller son las dos "pesos"). Cada caja tiene **un** medio de pago fijo
  (se configura en `CajaDialog` al crearla/editarla) — en «Nuevo movimiento»
  no se elige medio de pago por separado, se completa solo al elegir la
  caja. `MovimientoCaja.monto` está en la moneda de su `cajaId`. Arriba, un
  `StatCard` por medio de pago (`transferencia`, `pesos`, `tarjeta`, `canje`,
  consolidados en ARS) + **Total (ARS)**; los de medio de pago funcionan como
  filtro de la tabla (igual que el pipeline de Reparaciones). Debajo, toolbar
  con **«Nuevo movimiento»** y **«Conciliar cajas»**.
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
- **Compras** (`app/(app)/compras/`, migrado): espejo de Ventas del lado del
  gasto. `Compra.origen` distingue las dos formas en que se llega acá:
  `"proveedor"` (de siempre) — alta con proveedor (texto libre en la UI,
  resuelto a `proveedores` igual que en Inventario — `resolveProveedorId`,
  exportada desde `lib/db/inventario.ts` y reusada acá), ítems
  (detalle/cantidad/costo), medio de pago, estado `pendiente`/`recibida`; o
  `"canje"` — generada sola desde "Nueva venta" al elegir la caja de canje
  como medio de pago (ver "Ventas" arriba): `clienteId`/`cliente` en vez de
  `proveedor`, `ventaId` referencia esa venta, `estado` nace `"recibida"`
  (el equipo ya está en mano), y `marca`/`imei`/`checklist`/`aclaraciones`
  documentan el equipo recibido — `checklist` es el mismo shape que
  `Ticket.checklistIngreso` de Reparaciones. El detalle de una compra
  `canje` muestra ese bloque ("Información del equipo" + checklist +
  aclaraciones) y un botón **«Imprimir recibo de canje»**
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
  copiar/pegar en WhatsApp. Las entradas tipo "equipo"/"otro" son reglas
  (por condición / por categoría) que se evalúan en el momento contra el
  stock real — `expandirEntrada` recibe `equipos`/`otros` reales (vía
  `listEquipos()`/`listOtros()` de `lib/db/inventario.ts`) en vez de leer
  `lib/mock-data.ts`. `secciones` (estructura anidada con las entradas de
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
  turnos" (no "Asistencia": no existe ese estado, no se inventa) + "Sin
  confirmar (ya pasaron)" = `pendiente` con `dayOffset < 0` (proxy honesto de
  "no se sabe si vino"; medir asistencia real requeriría persistir el
  "Cliente llegó", decisión de producto fuera de alcance).
  Gráficos que **no** dependen del período llevan un chip
  `components/analiticas/periodo-chip.tsx` ("Estado actual") en el `sub` del
  `ChartTitle`; Inventario deshabilita el selector de período (solo el
  "Flujo de inventario" filtra). Duplicados quitados: "Ingresos por medio de
  pago" queda **solo en Finanzas**, el treemap de rubros **solo en Ventas**.
  "Facturación por vendedor" es ranking `BarRows` (sin límite de colores).
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
- **Dashboard** (`app/(app)/dashboard/`, migrado): **dos dashboards por
  rol, la ramificación vive en el server** (`page.tsx`, ver plan 005) —
  `admin` → `dashboard-admin.tsx`; `vendedor`/`tecnico` →
  `dashboard-empleado.tsx`. Regla de oro: **el filtrado por rol no es CSS ni
  esconder props — al empleado no se le calcula ni se le pasa ganancia,
  margen, `costoUsd` ni el objetivo de facturación de la org** (todo lo que
  viaja en el payload RSC se lee desde DevTools). El vendedor ve su propia
  facturación (tendencia SIN línea de ganancia — `TrendChart` tiene
  `ganancia?: number[]`, `undefined` = sin curva/marcadores/columna/tooltip
  de ganancia) y "Listos para retirar" de toda la org; el técnico ve sus
  tickets (`ticketsDeTecnico`). Sin cabecera de saludo ni widget "Taller"
  (se sacaron a pedido del usuario; la columna derecha es solo turnos
  agendados + ventas recientes). Cálculo en `lib/dashboard.ts` (con tests):
  `metricasDashboard` (5 métricas, `delta` **opcional** — los conteos
  puntuales no van con el chip "+0.0%"; `destacada` = la principal sobre
  `bg-accent` ocupando 2 columnas), `metricasEmpleado` (4 por rol),
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
  la tab "Mi cuenta" (visible a cualquier rol, ya era real desde antes vía
  `updateOwnProfile`). "Usuarios y roles" lista `profiles` reales de la org
  y conecta por primera vez `inviteMember`/`setMemberRole` de `lib/auth`
  (existían desde la Fase 0, ninguna UI los llamaba) — "Invitar usuario" y
  el pill de rol por fila (abre `CambiarRolDialog`), ambos validan admin
  server-side adentro de esas funciones. "Datos del negocio" es 1:1
  con la organización — no es una tabla aparte, son columnas nuevas en
  `organizations` (`direccion`/`telefono`/`cuit`/`horario`, además del
  `nombre` que ya existía); sin policy de `update` para `authenticated` (a
  propósito), el guardado va por `createServiceRoleClient()` +
  `requireRole("admin")` en `lib/db/configuracion.ts`, mismo criterio que
  `signUp`/`inviteMember`. "Recibos" (`RecibosForm`) es el mismo patrón
  (columnas `garantia_*` en `organizations`, mismo `updateNegocioAction`)
  con preview en vivo del recibo de Garantía al lado del form — ver "Recibos
  / PDFs". "Importar datos" (`importar-datos.tsx`) es un
  alta masiva vía CSV de equipos y clientes **existentes** (no ventas
  históricas — se descartó a propósito para no lidiar con fechas
  retroactivas ni con equipos "vendido" que ya no están en stock): parseo
  y validación con zod puros en `lib/importacion.ts` (con test, sin
  Supabase), dedupe explícito antes de insertar (equipos por IMEI —
  impuesto además por el `UNIQUE (organization_id, imei)` de la tabla;
  clientes por teléfono/email, que no tiene ningún constraint) tanto
  dentro del archivo subido como contra lo ya existente en la org, y un
  solo insert bulk por entidad (`createEquiposBulk`/`createClientesBulk`)
  en vez de un loop llamando a `createEquipo`/`createCliente` fila por
  fila. `estado` vacío en el CSV de equipos default a `en_revision`
  (mismo criterio que el alta manual). Admin-only vía `requireRole` en
  `importEquiposAction`/`importClientesAction` — el server revalida cada
  fila con el mismo schema que usa el preview del navegador, nunca confía
  en esa validación client-side.
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
aparte, solo Ventas → Garantía) agrega `ReciboSello` (insignia rotada,
`position: absolute` sobre la tarjeta, no ocupa fila propia) superpuesto
arriba a la derecha.

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
tenga `equipoId`; el ítem sin `equipoId` sale con "—" en la columna
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
- De los 6 tipos de `AppEvent`, `low_stock` está definido pero **nada lo
  dispara todavía** -- ninguna sección chequea stock contra el mínimo y
  publica el evento. Pendiente si se decide conectarlo.

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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
