# 014 — Demo sin cuenta (Dashboard + Ventas, 100 % en el navegador)

**Status:** DONE
**Implementado:** `/demo` (redirect a `/demo/dashboard`) + `/demo/dashboard` y
`/demo/ventas`, públicas sin sesión (`middleware.ts` → `ALWAYS_PUBLIC_PATHS`).
Datos 100 % en el navegador: `lib/demo/seed.ts` (seed determinista),
`lib/demo/store.tsx` (`DemoProvider`, espejo en `sessionStorage`
`tekly:demo:v1`), `lib/demo/operaciones.ts` y `lib/demo/ventas-query.ts`
(puros, con tests). `VentasClient` acepta `basePath`/`acciones`/`modoDemo`;
`DashboardAdmin`/`RecentSales` aceptan `ventasHref`; `RealtimeProvider` acepta
`enabled={false}` (demo sin transporte, nunca con el `organizationId` "demo").
Guard de aislamiento en `lib/demo/aislamiento.guard.test.ts` (los `import type`
no cuentan). CTAs "Ver demo" en la landing (nav + hero) y en el login.
`tsc` + `vitest` en verde; `/demo/dashboard` y `/demo/ventas` responden 200 sin
sesión. Verificación (Playwright, local): sin sesión carga; crear venta (cliente nuevo +
equipo del stock), persistir al recargar, sesión limpia en otra pestaña, reiniciar
y abrir el confirm de eliminar funcionan; 0 server actions y solo `dolarapi.com`
fuera del origen; sin overflow a 390/360 px. Pendiente: desplegar (en producción
`/demo` todavía redirige a `/login` hasta que el middleware nuevo esté deployado)
y comprobar `/ventas` y `/dashboard` reales con sesión.
**Scope:** ruta pública `/demo/*` con **Dashboard** y **Ventas** funcionando sobre datos de ejemplo que viven solo en el navegador (`sessionStorage`). Cero escrituras a la base, cero sesión, cero Supabase. Sin cambios de schema.

## Contexto

Se quiere que un visitante pruebe el sistema sin registrarse. Se evaluó (a) una
org demo compartida en Supabase (descartada: escribe en BD, hay que resetearla,
se pisan los visitantes), (b) un store en el server por cookie (descartado:
no persiste en serverless, exige Redis) y (c) una capa de datos intercambiable
para las 12 secciones (descartada: sobredimensionada). **Se elige el modelo
cliente-puro**: el estado de la demo es un array en `useState` espejado en
`sessionStorage`; se pierde al cerrar la pestaña.

Garantía de seguridad **por construcción**: nada bajo `app/demo/`, `lib/demo/`
ni los componentes que ella usa puede importar `lib/db/*` (son `server-only`) ni
`lib/auth/*` ni `@supabase/*`. Un test lo verifica (paso 8).

## Hallazgos del código que condicionan el diseño (leídos al planear)

- `app/(app)/ventas/ventas-client.tsx` (~2600 líneas) **está atado a la URL**:
  recibe `filtros`, `resumen`, `graficos`, `ventas` (ya filtradas/paginadas)
  desde el server y navega con `router.replace("/ventas?…")` (líneas ~256, 294,
  333) y `router.refresh()` (~356, ~734). Las mutaciones son
  `createVentaAction` (~2061) y `deleteVentaAction` (~341), importadas de
  `./actions`.
- También usa `useRealtime()` (`publish`) y `useDolar()` (fetch público a
  dolarapi.com, sirve tal cual en demo).
- Lógica **pura reutilizable**: `resumenDeVentas`, `graficosDeVentas`,
  `margenVenta`, `margenPonderado`, `categoriaDe` (`lib/ventas.ts`);
  `parseFiltrosVentas`, `rangoDe`, `queryDeFiltros`, `deltaHintDe`
  (`lib/ventas-filtros.ts`); `periodoAnterior`/`contextoPeriodo`
  (`lib/date-presets.ts`); `metricasDashboard`, `objetivoDelMes`,
  `ventaGananciaPorPeriodo`, `ventasPorRubro`, `ventasRecientes`
  (`lib/dashboard.ts`).
- **Lo que NO es puro y hay que reescribir en memoria**: el filtrado, orden y
  paginación de ventas/ítems que hoy hacen `listVentasPagina`,
  `listItemsVendidosPagina`, `contarVentas`, `contarItemsVendidos`,
  `resumenVentas`, `graficosVentas` de `lib/db/ventas.ts` (SQL), y el efecto de
  `createVenta`/`deleteVenta` (número de venta, marcar equipo `vendido`,
  descontar repuestos, movimientos de caja/CC).
- `components/dashboard/dashboard-admin.tsx` ya es client y recibe todo por
  props (los `lib/dashboard.ts` corren en `page.tsx`); pero usa
  `useRefrescoEnVivo` (→ `useRealtime` + `router.refresh`) y `RecentSales`
  linkea a `/ventas?open=`.
- `RealtimeProvider` del layout `(app)` usa un canal `crm-events:<organizationId>`
  en Supabase Broadcast: **en demo no hay que montarlo con Supabase** (todos los
  visitantes compartirían el canal `demo`).

## Decisiones (ya tomadas)

1. Secciones: **solo Dashboard y Ventas**. El resto no existe en `/demo`.
2. Rol fijo **admin** (se ve costo/margen y el dashboard completo).
3. Estado: `useState` + espejo en `sessionStorage` (clave `tekly:demo:v1`),
   envuelto en try/catch (puede fallar en ventanas privadas). Botón "Reiniciar"
   = volver al seed. Versionar la clave: si cambia el shape del seed, subir a `v2`.
4. Sin realtime en demo: `publish` es no-op; sin toasts cross-tab.
5. Alta de venta "cliente nuevo" y "equipo del stock" funcionan sobre el store
   local; **canje** (crea una Compra) y **cuenta corriente** se ocultan/
   deshabilitan en demo (no hay Compras ni CC): quitar esos dos medios del
   `Select` de pago cuando `demo`.
6. Imprimir comprobante/garantía **se deja** (es solo `window.print()` sobre
   datos locales). El membrete usa un `Negocio` de ejemplo ("Tekly Demo").
7. Indexación: `/demo` hereda `noindex` del root layout; no tocar `sitemap`/
   `robots`. El middleware solo lo deja pasar sin sesión.

## Pasos

### 1. Seed — `lib/demo/seed.ts` (+ `lib/demo/seed.test.ts`)

Función pura `crearSeedDemo(hoy: Date): DemoState` (no `Date.now()` suelto: se
inyecta `hoy` para tests deterministas). `DemoState` =
`{ ventas: Venta[]; equipos: Equipo[]; clientes: ClienteOpcion[]; repuestos;
otros; servicios; cajas: Caja[]; turnos: Turno[]; tickets: Ticket[]; negocio:
Negocio; contadorVentas: number }`, todo con los tipos de `lib/types.ts`
(leerlo antes; no inventar campos).

- ~12 clientes, ~15 equipos (mezcla de `disponible`/`vendido`/`reservado`, con
  IMEI falsos de 15 dígitos), algunos repuestos, 2–3 otros, 4–5 servicios,
  3 cajas (pesos, transferencia, USD).
- **~40 ventas repartidas en los últimos ~70 días** (fechas relativas a `hoy`,
  formato ISO sin hora como el resto de la app) para que Dashboard muestre
  mes actual vs. previo, tendencia y rubros; ítems con `categoria` variada
  (`equipo`/`servicio`/`otro`/`libre`) y `costoUsd` cargado en la mayoría
  (que haya margen). Pagos con 1–2 medios; algunos en pesos con
  `cotizacion`/`montoArs`.
- Turnos: ~8 en los próximos 7 días (heatmap + "Próximos"); tickets: ~6 con
  estados variados (el Dashboard cuenta abiertos).
- `negocio`: nombre "Tekly Demo", datos ficticios, `objetivoMesUsd` razonable
  (~120 % de la facturación típica del mes), `onboardingPasos` completo.
- Test: ids únicos, toda `Venta.items[].equipoId` existe, `totalUsd` = suma de
  ítems = suma de pagos, fechas dentro de rango, `categoriaDe` no revienta.

### 2. Store — `lib/demo/store.tsx`

`"use client"`. `DemoProvider` (React context) con `state`, y operaciones
puras de dominio (en `lib/demo/operaciones.ts`, **con tests**, sin React):

- `crearVentaDemo(state, input: CreateVentaInput-like, hoy) → { state, venta }`:
  número `V-<contador>`; marca `vendido` los `equipoId` de los ítems; descuenta
  stock de `repuestos` usados; `margenPct` con `margenVenta(items) ?? 0`;
  cliente "nuevo" → agrega a `clientes`; arma `Pago.cotizacion/montoArs` igual
  que `createVenta` (leer `lib/db/ventas.ts:566-760` como referencia del
  contrato, **sin importarlo**). No genera movimientos de caja (decisión 5).
- `eliminarVentaDemo(state, id, opts)`: saca la venta; con `restituirEquipos`
  vuelve los equipos a `disponible`; con `restituirRepuestos` devuelve stock.
- `reiniciar()` → `crearSeedDemo(new Date())`.
- Hidratación: **inicializar con el seed en el primer render** (igual en SSR y
  cliente) y recién en un `useEffect` leer `sessionStorage` y reemplazar —
  nunca leer storage en el initializer (rompe la hidratación, ver "Errores de
  UI" de CLAUDE.md). Persistir en un `useEffect` en cada cambio.

### 3. Filtrado en memoria — `lib/demo/ventas-query.ts` (+ test)

Reimplementa, **puro y con test**, lo que hace SQL en `lib/db/ventas.ts`, sobre
`state.ventas` + `FiltrosVentas` (importar el tipo de `lib/ventas-filtros.ts`):
`consultarVentas(state, filtros, rango, rangoAnterior)` →
`{ ventas (página), totalVentas, items (página de ítems vendidos), totalItems,
resumen, resumenAnterior, graficos, ventaAbierta }`. Reglas a respetar (están
en CLAUDE.md, sección Ventas): rango por fecha (hora Argentina, mismas
funciones `rangoDe`), `vendedor` por id, `tipo` por `categoriaDe` de los ítems,
`q` = número exacto | cliente `ilike` | `detalle` de ítems | IMEI de equipos,
`sort` (`fecha`/`total_usd`/`numero`/`margen_pct`) + `dir`, `PAGE_SIZE` = 50 de
`lib/pagination.ts`; `resumen` con `resumenDeVentas` y `graficos` con
`graficosDeVentas`. Comparar contra la query real (`lib/db/ventas.ts:274-510`)
para no divergir en semántica.

### 4. Hacer `VentasClient` independiente de la URL real y de las actions reales

Cambios **mínimos y retrocompatibles** (la app real no debe cambiar de
comportamiento; el default de cada prop nueva reproduce el actual):

- Prop `basePath?: string` (default `"/ventas"`): reemplazar los
  `router.replace(… "/ventas…")` literales (≈ líneas 256, 294, 333) por
  `basePath`.
- Prop `acciones?: { crearVenta; eliminarVenta; refrescar }` con default =
  `{ createVentaAction, deleteVentaAction, () => router.refresh() }`.
  Sustituir las llamadas en ≈ 341, 356, 734, 2061 (`NuevaVentaDialog` recibe
  `crearVenta` por prop). En demo `refrescar` es no-op (el store ya actualizó).
- Prop `modoDemo?: boolean` (default `false`): oculta `cuenta_corriente` y la
  caja de canje en el `Select` de medio de pago, y evita el link "Ver compra de
  canje". Si `useRealtime()` no funciona sin provider, envolver en un
  `RealtimeProvider` dummy o hacer que `publish` tolere ausencia (ver paso 6).
- Verificar que la sección real siga idéntica: `npx tsc --noEmit` + abrir
  `/ventas` con sesión.

### 5. Páginas demo

```
app/demo/layout.tsx          client-safe shell: DemoProvider + TopNav reducido + banner
app/demo/page.tsx            redirect("/demo/dashboard")
app/demo/dashboard/page.tsx  "use client" wrapper -> arma props con lib/dashboard.ts sobre state
app/demo/ventas/page.tsx     "use client" wrapper -> useSearchParams + consultarVentas -> <VentasClient/>
app/demo/demo-ventas.tsx / demo-dashboard.tsx   (si conviene separar)
```

- **No usar `requireUser`, `getNegocio` ni nada de `lib/db`.** El layout NO está
  dentro de `(app)`.
- `demo/ventas`: `parseFiltrosVentas(Object.fromEntries(searchParams), {
  puedeVerCosto: true })` → `rangoDe` → `periodoAnterior` → `consultarVentas`
  (memoizado) → `<VentasClient basePath="/demo/ventas" modoDemo acciones={…}
  user={USUARIO_DEMO} negocio={state.negocio} … />`. Los params (`open`, `q`,
  `accion=nueva-venta`) siguen funcionando porque el cliente real ya los lee.
- `demo/dashboard`: mismas llamadas que `app/(app)/dashboard/page.tsx` (admin),
  sobre `state.ventas/tickets/turnos`, `<DashboardAdmin … />`. Dos ajustes en
  `DashboardAdmin`/`RecentSales`: prop `ventasHref?: string` (default
  `"/ventas"`, en demo `"/demo/ventas"`) y que `useRefrescoEnVivo` sea no-op sin
  provider (o prop `enVivo={false}`). Mantener `Section` + `mainClassName`.
- `USUARIO_DEMO: SessionUser` constante en `lib/demo/usuario.ts`
  (`rol: "admin"`, `organizationId: "demo"`, nombre "Visitante demo", **sin**
  `terminosVersion` problemático — leer `lib/auth/types.ts`).
- El `TopNav` real usa `navForRole`/`user`; si no se deja reutilizar sin
  sesión, hacer `components/demo/demo-nav.tsx` mínimo (logo vía `TeklyLogo` +
  2 links Dashboard/Ventas + `Button` "Crear cuenta" a `signupUrl()`), responsive
  (en mobile alcanzan 2 links, sin drawer).

### 6. Aislar el realtime

Verificar cómo falla `useRealtime()` fuera de `RealtimeProvider`
(`components/notifications/realtime-provider.tsx`). Solución preferida: un
`RealtimeProvider` con prop `transport="none"` (o un `DemoRealtimeProvider`
con `publish`/`subscribe` no-op) montado en `app/demo/layout.tsx`. **Nunca**
montarlo con el `organizationId` "demo" real (canal compartido entre
visitantes).

### 7. Banner, entrada y middleware

- `components/demo/demo-banner.tsx`: franja fija arriba "Estás en la demo — los
  datos se guardan solo en esta pestaña" + `Button` outline "Reiniciar demo"
  (con `ConfirmDialog` o `confirm` propio del repo, **no** `window.confirm`) +
  `Button` primary "Crear cuenta gratis". Botones con el sistema único
  (`components/ui/button.tsx`); un test guarda (`lib/botones.guard.test.ts`)
  falla si se escribe uno a mano.
- `middleware.ts`: agregar `"/demo"` a `ALWAYS_PUBLIC_PATHS` (ojo: `startsWith`,
  no choca con otras rutas). Confirmar que en `sistema.tekly.tech` y en dev
  `/demo` carga sin sesión y que un usuario **con** sesión también puede verla.
- CTAs "Ver demo": landing (`components/marketing/` — hero y/o nav, usando
  `MarketingButton`/`lib/marketing/app-url.ts` para apuntar a
  `${NEXT_PUBLIC_APP_URL}/demo/dashboard`) y un link secundario en
  `app/login/login-form.tsx`. No cambiar el aspecto de `MarketingButton`.

### 8. Verificación

- `npx tsc --noEmit` y `npx vitest run` (sumar tests de seed, operaciones y
  ventas-query).
- **Test guarda de aislamiento** `lib/demo/aislamiento.guard.test.ts`: leer los
  archivos de `app/demo/**`, `lib/demo/**`, `components/demo/**` y fallar si
  contienen `@/lib/db/`, `@/lib/auth`, `@supabase/` o `server-only` (mismo
  estilo que `lib/botones.guard.test.ts`).
- Manual (con `npm run dev`, no correr `next build` a la vez):
  1. `/demo` sin sesión → Dashboard con datos, tendencia, rubros, objetivo,
     turnos, ventas recientes; cambiar período 7d/mes/etc. anda.
  2. Click en una venta reciente → `/demo/ventas?open=…` abre el detalle.
  3. Ventas: filtros, búsqueda (número, cliente, IMEI), orden, paginación,
     tab "Ítems vendidos", detalle, Comprobante/Garantía (imprime).
  4. «Nueva venta» (equipo del stock + pago dividido + cliente nuevo) → aparece
     arriba en la lista y suma en el Dashboard al volver; el equipo pasa a
     `vendido`.
  5. Eliminar una venta con "devolver equipos" → vuelve a `disponible`.
  6. Recargar la pestaña → se conserva; cerrar y abrir otra → seed limpio;
     «Reiniciar demo» → seed limpio.
  7. **Red:** en DevTools → Network, ninguna request a `*.supabase.co` ni
     server action durante todo el recorrido (salvo `dolarapi.com`).
  8. 390 y 360 px: banner y nav no desbordan.
  9. `/ventas` y `/dashboard` reales (con sesión) siguen **idénticos**.

## Fuera de alcance (a propósito)

Resto de las secciones, roles vendedor/técnico, Compras/canje, cuenta corriente,
movimientos de caja, realtime, importación CSV, persistencia entre pestañas o
dispositivos, indexación SEO de la demo, analytics de uso de la demo.

## Riesgos / cuidados

- **Divergencia semántica** entre `lib/demo/ventas-query.ts` y las queries SQL
  reales: mitigar leyendo `lib/db/ventas.ts` y cubriendo con tests los filtros
  (preset/rango, `q`, `tipo`, `sort`).
- **Hidratación:** nada que dependa de `sessionStorage`, `Date.now()` o
  `useDolar()` en el primer render del server; `hoy` y el seed se calculan igual
  en ambos lados o el contenido se monta tras `useEffect`.
- `ventas-client.tsx` es enorme: tocar solo los puntos del paso 4, sin
  reformatear.
- Si el espejo en `sessionStorage` supera la cuota (no debería: pocas KB),
  degradar a solo-memoria sin romper.
