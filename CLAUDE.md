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
app/login/, app/signup/   fuera del grupo (app) -- fondo blurreado + AuthModal
middleware.ts             protege rutas (sin sesión -> /login)
components/ui/            primitivos reutilizables (ver abajo)
components/auth/          AuthModal, AppPreviewBackdrop, UserMenu
components/dashboard/     widgets del Dashboard
components/notifications/ Toaster + SimPanel (en layout) + NotificationsBell (en Topbar)
lib/auth/                 sesión + login/signup -- única puerta a @supabase/* para auth
lib/db/<dominio>.ts       una por dominio migrado -- única puerta a @supabase/* para datos
lib/mock-data.ts          datos de ejemplo de las secciones TODAVÍA no migradas
lib/types.ts              tipos del dominio (contrato entre lib/db y las páginas)
lib/status.ts             estados (tickets, equipos, turnos, pagos) + tonos
lib/format.ts             formateo de moneda / fechas
lib/realtime.ts           pub/sub de eventos + describe() para el toast
lib/cajas.ts, lib/ventas.ts  lógica de negocio pura (sin Supabase) con tests en *.test.ts
supabase/migrations/      schema versionado, aplicado vía MCP al proyecto real
```

Páginas server por defecto; `"use client"` solo donde hay interacción
(filtros, dialogs, estado local, `publish`).

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
  `turnos`, `ventas`, `cajas`, `movimientos_caja`, `conciliaciones`,
  `movimientos_cc`, `compras`, `listas_difusion`), todas con
  `organization_id` (con `DEFAULT current_user_org_id()` — un insert de la
  app no necesita pasarlo a mano, y la policy `WITH CHECK` lo sigue validando
  igual si alguien lo manda). Columnas en snake_case; los tipos de
  `lib/types.ts` son camelCase — el mapeo vive en cada `lib/db/<dominio>.ts`.
- Estructuras anidadas (`Venta.items`/`pagos`, `Ticket.servicios`,
  `Turno.pagos`, `Conciliacion.lineas`, `Compra.items`, `OtroItem.unidades`,
  `ListaDifusion.secciones`) se guardan como `jsonb` tal cual el shape de
  `lib/types.ts` — son snapshots embebidos, no relaciones vivas.
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

`types.ts` (`SessionUser`, `Rol`), `supabase.ts` (los tres clientes:
`createServerClient` para Server Components/Actions, `createMiddlewareClient`
para `middleware.ts`, `createServiceRoleClient` para altas privilegiadas —
**server-only**, nunca en un componente cliente), `index.ts` (`requireUser()`,
`requireRole(...)`, `signIn`/`signUp`/`signOut`/`inviteMember`,
`updateOwnProfile`/`setMemberRole`), `validation.ts` (schemas de `zod` para
los forms de auth).

`requireUser()` en `app/(app)/layout.tsx` protege todo lo que cuelga de ese
grupo; `middleware.ts` además redirige a `/login` antes de que la página
llegue a renderizar. Ninguna página/componente importa `@supabase/*`
directo — todo pasa por `lib/auth` (sesión) o `lib/db/<dominio>` (datos).

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

`/login` y `/signup` están fuera del grupo `(app)`, con su propio layout:
fondo = `AppPreviewBackdrop` (maqueta muda del shell de la app, blureada,
`components/auth/app-preview-backdrop.tsx`) + `AuthModal`
(`components/auth/auth-modal.tsx`, mismo header índigo que `Dialog` con
`accent`) centrado encima. `UserMenu` (`components/topnav.tsx`) reemplaza el
avatar simple: muestra nombre/rol y permite cerrar sesión o editar nombre/
alias (`updateOwnProfile`).

Signup (`lib/auth/index.ts`): crea el usuario de auth, y si algo falla
después (org o perfil), hace **rollback** del usuario recién creado — sin
esto queda una cuenta fantasma que bloquea reintentar con el mismo email.

Ambiente de desarrollo: en Supabase Dashboard → Authentication → Providers →
Email, "Confirm email" está **desactivado** (el email service default de
Supabase tiene rate limit muy bajo, pensado solo para pruebas puntuales) —
ver "Qué falta" para el plan antes de producción.

### Variables de entorno

`.env.local` (gitignored, ver `.env.local.example`):
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (públicas) +
`SUPABASE_SERVICE_ROLE_KEY` (secreta, **nunca** con prefijo `NEXT_PUBLIC_`,
server-only). Cambios acá requieren reiniciar `npm run dev`.

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
Además, un puñado de datasets puntuales sigue en `lib/mock-data.ts` porque falta trackear el
dato que los sustenta, no por falta de migrar la sección —
`clientesDemografia` (`Cliente` no guarda edad); en Analíticas
`tiempoPorFalla` (no hay timestamp de "listo/entregado" en `tickets`),
`rendimientoTecnicos` (no hay reingresos ni calificación en ningún lado) y
`margenPorTipo`/`salesByMonth`; y en Dashboard `ventasPorRubro` — estos
últimos porque `Venta.tipo` real solo distingue 'venta'/'reparacion', no hay
categoría "Accesorios"/"Otros" separada. `monthGoal.target` (la meta del
mes) tampoco es "dato falso": es un valor de negocio sin owner de
configuración todavía (`current`, en cambio, ya es 100% real). Cada caso
tiene un comentario en el código explicando por qué sigue en mock — agregar
esas columnas/ese owner es una decisión de producto, no algo a resolver de
paso en una migración.

### Qué falta antes de producción

- **SMTP propio para Auth** (Resend/Postmark) y reactivar "Confirm email" —
  el email service default de Supabase no es apto para usuarios reales.
- **Leaked password protection** (Authentication → Policies): desactivada
  por default, activar antes de producción.

## Sistema de diseño

Referencia visual: "Cocos CRM" — limpio, mucho whitespace, esquinas
redondeadas, paleta neutra + un acento **índigo**.

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

**Números hero** (valor de `StatCard` / `MetricCards`, número grande de un
gráfico): fuente **Space Grotesk** vía la utilidad `font-grotesk` (cargada con
`next/font` en `app/layout.tsx`, variable `--font-space-grotesk`; el resto de la
UI usa `system-ui`). `StatCard` ya la aplica → una fila de KPIs con `StatCard`
sale sola. El `MetricCards` del dashboard (card compacta propia) también.

**Labels y eyebrows en MAYÚSCULA**: el `Label` de `components/ui/field.tsx` ya
sale `text-[11px] font-semibold uppercase tracking-wider`. Para separadores de
sección dentro de un form/dialog usar el mismo estilo (ej. `Eyebrow` en el
modal de Nueva venta). Va en línea con `ChartTitle` y los headers de tabla.

### Espaciado, radios, layout

- Card: `p-4` (stats / compacto) · `p-5` (gráficos y paneles).
- Grillas: `gap-4` para filas de stats · `gap-6` para bloques de sección.
- Contenedor de sección: `space-y-5` o `space-y-6`. `<main>` tiene `p-8`.
- Sidebar fijo `w-60`; el contenido va en `<div className="pl-60">`.
- Radios: card `rounded-2xl` · inputs/botones/tabs `rounded-lg` ·
  chips/barras `rounded-md` · badges/avatares `rounded-full` ·
  icon tiles `rounded-xl`.

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
  Los `.recibo-print` van sin cebra.
- **Todo alineado a la izquierda** por defecto (`th, td { text-align:left }`).
- **Opt-out por celda**: `text-end` / `text-right` alinea a la derecha
  (columnas de plata / números: `Monto`, `Total`, `Precio`, `Costo`, `Margen`);
  `text-center` centra (ej. celda vacía "sin resultados"). `text-start` sigue.
- Números en columnas → `tabular-nums`. Texto de las celdas: peso normal (dejar
  `font-semibold` solo para el dato que tiene que destacar, ej. Total).
- Fuera de tablas, alinear a la izquierda con `text-start`.

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
`heatCell(count, 0, max)` (usa `HEAT_SCALE` índigo). Celdas cuadradas
(`aspect-square`), columnas de ancho fijo para que queden pegadas.

**Tooltip de hover** (Tendencia, Turnos): caja `bg-neutral-900` texto blanco,
`rounded-lg`, `shadow-lg`, `pointer-events-none`. Título centrado; cada fila
`label` a la izquierda y valor a la derecha (`ml-auto`). Se ancla al **borde** de
la barra/celda + gap, y salta al otro lado cerca del borde derecho.

**Leyenda**: obligatoria si hay ≥ 2 series. Con ≤ 4 series, además etiqueta
directa (ej. el `%` dentro del segmento de la dona) — identidad nunca solo por
color.

### Otros primitivos

| Componente | Archivo | Notas |
|---|---|---|
| `Section` | `components/section.tsx` | `{ title, children, mainClassName?, toolbar? }` — wrapper de toda página. El `Topbar` **ya no muestra `title`** (se mantiene por compat); `toolbar` = control opcional en la Topbar (ej. selector de período del dashboard). **Sin `actions`** |
| `Card` | `components/ui/card.tsx` | contenedor base (`rounded-2xl border shadow-sm`) |
| `Button` | `components/ui/button.tsx` | `variant: primary \| outline \| ghost`, `size: sm \| md` |
| `Badge` | `components/ui/badge.tsx` | `{ tone, dot?, className? }` — forma ÚNICA cuadrada (`rounded-md`); no hay prop de forma. Colores por `lib/status.ts` |
| `Dialog` | `components/ui/dialog.tsx` | `{ open, onClose, title, description?, footer?, size: md \| lg, accent? }` — **centrado vertical**, con scroll propio si el contenido es alto; cierra con Esc / click fuera. Para resetear el estado interno al reabrir: `key={abierto ? "a" : "b"}` en el uso |
| `Tabs` | `components/ui/tabs.tsx` | `{ value, onChange, options: [{ value, label, count? }], accent? }` — `accent` (hex) para teñir el estado activo con otro color; por defecto usa `accent` |
| `Field` / `Input` / `Select` / `Textarea` / `Label` | `components/ui/field.tsx` | inputs con estilo consistente; `Field` = `Label` + control |

### `Dialog`: todos los de una sección son una sola familia visual

Regla de oro: **los dialogs de una misma sección tienen que verse como parte
del mismo sistema entre sí** — mismo header, misma familia de botones en el
footer. No mezclar el header violeta con un footer de otra familia de botón
(o viceversa) dentro de la misma sección; eso es lo primero que se nota mal.

Hay dos familias de botón para el footer, y van pegadas a si el `Dialog`
lleva `accent` o no:

- **Header violeta (`accent`)** → footer con **pills a mano** (`<button>`,
  no el componente `Button`): «Cancelar» = pill neutro
  `rounded-full border border-neutral-200 px-4 text-sm font-semibold
  text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50`; la acción
  primaria = pill sólido `rounded-full bg-accent px-4 text-sm font-semibold
  text-white hover:bg-accent/90 disabled:opacity-50`; acciones extra (ej.
  «Recibo de mercadería») = pill `border-accent/40 text-accent`. Esta es la
  familia por defecto — úsala tanto para dialogs de **detalle/vista**
  (ficha de cliente, ticket, venta, movimiento de caja — sección
  "Información general" en grid de `Card`: `grid grid-cols-3 gap-3`, cada
  celda `<Card className="p-3 text-center">` con label `font-grotesk
  border-b border-neutral-300 ... uppercase` + valor `mt-2 text-sm`) como
  para los de **alta/edición** de esa misma sección (`EquipoFormDialog` en
  Inventario, `CajaDialog` y `NuevoMovimientoDialog` en Cajas — mismo
  `accent`, mismo footer a pills, body con `Field` normal).
- **Header blanco (sin `accent`)** → footer con el componente **`Button`**
  (`variant="outline" size="sm"` para «Cancelar», `size="sm"
  disabled={...}` para la acción primaria). Úsala en secciones que **no**
  tienen ningún dialog de detalle/vista con `accent` todavía —
  `NuevoClienteDialog` (Clientes), `NuevoTicketDialog` (Reparaciones),
  `ServicioDialog` (Servicios), **Nueva venta** (Ventas, el form completo —
  ver punto 4 abajo).

En ambas familias: body `<div className="space-y-3">` con `Field` + `Input`
/ `Select` / `Textarea` apilados (pares cortos → `grid grid-cols-2 gap-3`);
un flag booleano tipo "activo" va como checkbox debajo de los campos,
**dentro del dialog** — no como botón aparte en la fila de la tabla
(`ServicioDialog`, "Servicio activo", es la referencia). Título: `id ?
"Editar X" : "Nuevo X"`. Para elegir entre opciones dentro de un form usar
**`Select`**, nunca `Tabs` — `Tabs` es el pill de navegación/filtro de
página (Del día/Historial, Equipos/Repuestos/Otros), no un control de
formulario.

## Convenciones al agregar una sección

Para una sección que **ya está migrada** a datos reales (ver lista en
"Backend y multi-tenancy"), seguir el patrón `page.tsx` + `*-client.tsx` +
`actions.ts` + `lib/db/<dominio>.ts` de esa sección como referencia — no el
patrón mock de abajo.

Para migrar una sección que sigue en mock, o agregar una completamente nueva:

1. `app/(app)/<seccion>/page.tsx`: server component, devuelve
   `<Section title="…">` con el fetch inicial vía `lib/db/<dominio>.ts`.
   **El header de sección NO lleva botones ni acciones — solo el título.**
   Las acciones de sección (alta, filtros, «Recuento», etc.) van en una
   **toolbar arriba del contenido**, alineadas a la derecha con `ml-auto`
   (o al lado de las `Tabs`). Acciones globales / destructivas (ej.
   «Conciliar cajas») van **abajo** de la página. `Section` no acepta
   `actions`.
2. Agregar el ítem a `NAV` en `lib/nav.ts` (href, label, icono de lucide,
   `roles?` si hace falta acotarlo a admin/vendedor/técnico — ver
   `navForRole`).
3. Datos → tabla en `supabase/migrations/` (`organization_id` con `DEFAULT
   current_user_org_id()`, RLS con las 4 policies `to authenticated`) +
   `lib/db/<dominio>.ts` (mapeo snake_case → camelCase a un tipo de
   `lib/types.ts`). La interacción (dialogs, filtros, estado local) va en
   `<seccion>-client.tsx`; las mutaciones en `actions.ts`
   (`requireUser()` + `revalidatePath`).
4. KPIs arriba → `StatCard`. Tablas → `<Card>` + `<table>` (headers y celdas
   ya vienen con estilo del global). Estados → `Badge` + `lib/status.ts`.
   Medios de pago (`MedioPago`): `pesos`, `dolares`, `transferencia`, `cripto`,
   `tarjeta`, `canje`. `Venta.pagos` es `Pago[]` = `{ medio, montoUsd }[]`
   (1+ medios, pago dividido; la suma cubre `totalUsd`). Formularios → `Dialog`
   + `Field`.
   El modal de **Nueva venta** (`app/(app)/ventas/ventas-client.tsx`) es la
   referencia de form completo: eyebrows en mayúscula, cliente existente/
   nuevo, ítems desde el stock (`equipos`) o libres, y pago dividido con
   conciliación (faltan/sobran/completo + botón «Saldar» — lógica en
   `lib/ventas.ts`, no reimplementarla inline).
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
  reservado), igual criterio que Ventas.
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
  catálogo editable). **No hay sección `/servicios`**, vive acá. El detalle
  de ticket tiene botón **«Recibo de mercadería»** (ver Recibos). No hay
  tabla de "técnicos": son `profiles` con `rol = 'tecnico'`
  (`lib/db/reparaciones.ts` → `listTecnicos`).
- **Ventas** (`app/(app)/ventas/`, migrado): click en una fila → detalle
  (`VentaDetalle`) con botones **«Comprobante de venta»** y, si hay un pago
  `canje`, **«Recibo de equipo en parte de pago»**. `VentaItem.costoUsd?` y
  `Venta.procedencia?` existen; el costo NO se muestra ni edita en el modal de
  alta. Vender un ítem con `equipoId` marca ese equipo `vendido`. "Cliente
  nuevo" en el modal ahora persiste de verdad (`createCliente`) antes de
  crear la venta. El margen/restante/saldar del pago dividido usan
  `lib/ventas.ts` (con tests), no lógica inline.
- **Clientes** (`app/(app)/clientes/`, migrado): tabla (no cards). Fila →
  ficha con historial cruzado real (ventas/tickets/turnos vía
  `lib/db/clientes.ts`); toolbar «Nuevo cliente». `compras`/`reparaciones`/
  `gastadoUsd` son calculados, no columnas — ver "Backend y multi-tenancy".
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
  gasto. Alta con proveedor (texto libre en la UI, resuelto a
  `proveedores` igual que en Inventario — `resolveProveedorId`, exportada
  desde `lib/db/inventario.ts` y reusada acá), ítems (detalle/cantidad/
  costo), medio de pago, estado `pendiente`/`recibida`. Si el medio es
  "pesos" se guarda `montoArs`/`cotizacion` con el dólar del momento
  (`useDolar()`), igual criterio que otros montos en ARS de la app. La
  tabla `compras` no traía una referencia legible como `ventas.numero` —
  se le agregó (`supabase/migrations/20260914000000_compras_numero.sql`),
  mismo patrón, expuesta como `"C-<numero>"`.
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
- **Analíticas** (`app/(app)/analiticas/`, migrado): `page.tsx` (server) trae
  ventas/equipos/repuestos/otros/clientes/turnos/cajas/movimientos reales de
  los `lib/db/*` ya existentes (ninguna query nueva) y calcula
  `ventasPorMes`/`facturacionDiaria` reales a partir de `ventas` —
  `lib/analiticas.ts`, con test (cuidado ahí con el bug de huso horario:
  `fechaISO` se lee con `.slice()`, nunca con `new Date(iso).getMonth()`,
  que corre un día en husos negativos). `FuenteClientes` es un server
  component (async) desde que se migró Clientes — no se puede importar
  directo en el client component de Analíticas, así que `page.tsx` lo
  renderiza y lo pasa como children. Facturación por vendedor, ingresos por
  medio de pago, ventas por canal (`procedencia`), equipos por estado y
  facturación acumulada (SVG) ya eran cálculos genéricos sobre esos arrays,
  no cambiaron. `tiempoPorFalla`, `rendimientoTecnicos`, `margenPorTipo` y
  `TendenciaRubros` (`salesByMonth`) siguen en mock — ver "Estado de la
  migración" arriba para el porqué de cada uno. Helper `BarRows`.
- **Dashboard** (`app/(app)/dashboard/`, migrado): `page.tsx` (server) trae
  ventas/equipos/tickets/turnos vía los `lib/db/*` ya existentes y calcula
  todo lo derivable con `lib/dashboard.ts` (con tests):
  `metricasDashboard` (las 6 `MetricCard` — delta 0 en las que son un
  conteo puntual sin serie histórica: tickets abiertos, equipos en
  revisión, turnos hoy), `objetivoDelMes` (`current`/`prevTotal` reales;
  `target` sigue en `monthGoal` de `lib/mock-data.ts`, sin owner de
  configuración), `ventaGananciaPorPeriodo` (venta/ganancia por día para
  los 3 períodos del selector — mismo cuidado de fechas que
  `lib/analiticas.ts`) y `ventasRecientes` (categoría derivada de
  `Venta.tipo`). `ventasPorRubro` (mix de categorías del hover de
  `TrendChart`/`RubrosPie`) sigue en mock, mismo motivo que en Analíticas.
  Los 6 widgets (`components/dashboard/*`) pasaron de importar mock-data
  directo a recibir todo por prop desde `dashboard-client.tsx`.
- **Configuración** (`app/(app)/configuracion/`, migrado): admin-only salvo
  la tab "Mi cuenta" (visible a cualquier rol, ya era real desde antes vía
  `updateOwnProfile`). "Usuarios y roles" lista `profiles` reales de la org
  y conecta por primera vez `inviteMember`/`setMemberRole` de `lib/auth`
  (existían desde la Fase 0, ninguna UI los llamaba) — "Invitar usuario" y
  el pill de rol por fila (abre `CambiarRolDialog`), ambos validan admin
  server-side adentro de esas funciones. "Plantillas WhatsApp" es CRUD real
  contra la tabla nueva `whatsapp_templates`. "Datos del negocio" es 1:1
  con la organización — no es una tabla aparte, son columnas nuevas en
  `organizations` (`direccion`/`telefono`/`cuit`/`horario`, además del
  `nombre` que ya existía); sin policy de `update` para `authenticated` (a
  propósito), el guardado va por `createServiceRoleClient()` +
  `requireRole("admin")` en `lib/db/configuracion.ts`, mismo criterio que
  `signUp`/`inviteMember`.
- **Cotización del dólar**: `lib/dolar.ts` (`useDolar()` → blue de
  `dolarapi.com`, cache en memoria, fallback `1465`). Se muestra en el
  `Topbar` vía `components/dolar-navbar.tsx`. **No está en Configuración.**
- **Proveedores**: sección eliminada.

### Recibos / PDFs

`components/recibos/recibo.tsx`: `ReciboDialog` (Dialog + botón «Imprimir /
Guardar PDF» → `window.print()`) que envuelve `ReciboShell` (hoja con membrete
Tekly, N°, fecha, firmas). Helpers `ReciboCampos` (pares clave/valor) y
`ReciboLineas` (tabla con total). La impresión se aísla con `@media print` en
`app/globals.css`: se oculta todo salvo `.recibo-print`. 3 usos:
recibo de mercadería (Reparaciones), comprobante de venta y recibo de canje
(Ventas). El membrete (nombre/dirección/CUIT/teléfono) toma `negocio` real
(`lib/db/configuracion.ts` → `getNegocio()`) pasado como prop desde cada
`page.tsx` hasta `ReciboDialog` — el import de `lib/mock-data.ts` que queda
en el archivo es solo el valor por default del prop, nunca se usa (ambas
páginas siempre lo pasan).

## Notificaciones en tiempo real

`lib/realtime.ts`:

- `publish(e: AppEvent)` / `subscribe(fn)`. El emisor **no** recibe su propio
  evento (son "acciones de otros").
- Transporte: si hay `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  → Supabase Realtime Broadcast (canal `crm-events`). Si no → `BroadcastChannel`
  nativo (cross-tab en el mismo browser). `transport` expone cuál está activo.
- `AppEvent` (unión): `sale_confirmed`, `ticket_ready`, `repair_approved`,
  `appointment_arrived`, `low_stock`. Agregar un tipo nuevo = extender la unión
  **y** el `switch` de `describe()`.
- `describe(e)` → `ToastView` que renderiza `components/notifications/toaster.tsx`.
- `components/notifications/bell.tsx` (`NotificationsBell`, en el `Topbar`)
  también se suscribe: guarda las últimas ~15 notificaciones con timestamp y
  las muestra en un dropdown al tocar la campanita, con contador de no leídas.
- `components/notifications/sim-panel.tsx` es el botón flotante "Simular" para
  disparar eventos fake y probar los toasts en otra pestaña.

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
