# CLAUDE.md

Guía para trabajar en este repo. Leer antes de agregar secciones o componentes.

## Qué es

MVP **puramente visual** de un CRM interno para un negocio de venta y reparación
de iPhones. Una sucursal, 4-5 usuarios, 3 roles (admin, vendedor, técnico).

- **Sin backend, sin base de datos, sin auth real.** Usuario "logueado" fijo
  (`currentUser` en `lib/format.ts`).
- Todos los datos son mock en `lib/mock-data.ts` + estado local de React. Al
  refrescar se vuelve al set inicial. No agregar tablas de Supabase para datos
  de negocio.
- Supabase Realtime (Broadcast, sin tablas) se usa **solo** para el pub/sub de
  notificaciones entre pestañas/sesiones.

El foco es que la navegación, el layout y los toasts en tiempo real se sientan
bien — no la lógica de negocio ni validaciones avanzadas.

## Comandos

```bash
npm run dev          # http://localhost:3100
npm run build        # build de producción
npx tsc --noEmit     # typecheck (correr antes de dar por terminado un cambio)
```

No correr `next build` con el `dev` server levantado: pelean por `.next` y
tiran 500 intermitentes.

## Stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind 3 · `lucide-react`.
Sin shadcn/ui instalado — los componentes son propios, en `components/ui/`.
Alias de import: `@/*` → raíz del repo.

## Arquitectura

```
app/<seccion>/page.tsx   una página por ítem del sidebar (lib/nav.ts)
components/ui/            primitivos reutilizables (ver abajo)
components/dashboard/     widgets del Dashboard
components/notifications/ Toaster + SimPanel (en layout) + NotificationsBell (en Topbar)
lib/mock-data.ts          TODOS los datos de ejemplo
lib/types.ts              tipos del dominio
lib/status.ts             estados (tickets, equipos, turnos, pagos) + tonos
lib/format.ts             formateo de moneda / helpers + currentUser
lib/realtime.ts           pub/sub de eventos + describe() para el toast
```

Páginas server por defecto; `"use client"` solo donde hay interacción
(filtros, dialogs, estado local, `publish`).

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
| `CHART_COLORS` | 5 pasos `#211d52 → #948dde` | categorías (dona, barras apiladas, pipeline). Ordenadas |
| `chartColor(i)` | — | cicla `CHART_COLORS` |
| `CHART_ACCENT` | `#4f49bd` | líneas y rellenos con presencia (= `accent`) |
| `HEAT_SCALE` | 6 pasos `#e9e8f9 → #211d52` | rampa de heatmaps (claro→oscuro) |
| `CHART_TRACK` | `#e9e8f9` | pista de arcos / fondo "fantasma" |
| `GHOST_STRIPES` | rayado gris 45° | barra en reposo / tramo no cumplido |

`heatCell(v, min, max, scale?)` toma la escala como 4º arg opcional (default
`HEAT_SCALE`). `DASH_COLORS` / `dashColor` / `DASH_ACCENT` / `DASH_HEAT` son
**aliases** de las de arriba (se estrenaron en el dashboard; ya son globales).

**Estados y badges:** nunca hardcodear colores de estado. Usar `Badge` +
el map de `lib/status.ts` (`ticketStatus`, `equipoStatus`, `turnoStatus`,
`turnoTipo`, `medioPago`, `otroCategoria`), cada uno devuelve `{ label, tone }`
(salvo `otroCategoria` que es solo label). `tone ∈ blue | amber | green | gray
| red | violet`. **Todos los `Badge` son iguales**: forma cuadrada
(`rounded-md`), `text-xs`. No hay variante pill — la única forma es la que trae
el componente.

### Tipografía (escala en uso)

| Clase | px | Uso |
|---|---|---|
| `text-2xl` | 24 | valor grande de `StatCard`, número hero de un gráfico |
| `text-lg` | 18 | contadores medianos / encabezados grandes de card (el `Topbar` ya **no** tiene h1) |
| `text-sm` | 14 | body, celdas de tabla, cuerpo de card |
| `text-[13px]` | 13 | texto secundario denso (listas, filas compactas) |
| `text-xs` | 12 | labels, captions, `ChartTitle`, `Badge` |
| `text-[11px]` | 11 | micro: `Delta`, leyendas ("vs mes previo", "del objetivo") |

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
- Barras: `rounded-t-xl`, ancladas a la base; la más alta llena la banda
  (`SCALE = 100`). Barra en reposo / tramo no cumplido = `GHOST_STRIPES`
  (rayado gris de `lib/chart.ts`).
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
| `Dialog` | `components/ui/dialog.tsx` | `{ open, onClose, title, description?, footer?, size: md \| lg }` — **centrado vertical**, con scroll propio si el contenido es alto; cierra con Esc / click fuera. Para resetear el estado interno al reabrir: `key={abierto ? "a" : "b"}` en el uso |
| `Tabs` | `components/ui/tabs.tsx` | `{ value, onChange, options: [{ value, label, count? }], accent? }` — `accent` (hex) para teñir el estado activo con otro color; por defecto usa `accent` |
| `Field` / `Input` / `Select` / `Textarea` / `Label` | `components/ui/field.tsx` | inputs con estilo consistente; `Field` = `Label` + control |

## Convenciones al agregar una sección

1. `app/<seccion>/page.tsx` que devuelve `<Section title="…">`.
   **El header de sección NO lleva botones ni acciones — solo el título.**
   Las acciones de sección (alta, filtros, «Recuento», etc.) van en una
   **toolbar arriba del contenido**, alineadas a la derecha con `ml-auto`
   (o al lado de las `Tabs`). Acciones globales / destructivas (ej. «Cerrar
   caja del día») van **abajo** de la página. `Section` ya no acepta `actions`.
2. Agregar el ítem a `NAV` en `lib/nav.ts` (href, label, icono de lucide).
3. Datos → `lib/mock-data.ts` (con su tipo en `lib/types.ts`). Estado editable
   → `useState` sembrado con esos datos.
4. KPIs arriba → `StatCard`. Tablas → `<Card>` + `<table>` (headers y celdas
   ya vienen con estilo del global). Estados → `Badge` + `lib/status.ts`.
   Medios de pago (`MedioPago`): `pesos`, `dolares`, `transferencia`, `cripto`,
   `tarjeta`, `canje`. `Venta.pagos` es `Pago[]` = `{ medio, montoUsd }[]`
   (1+ medios, pago dividido; la suma cubre `totalUsd`). Formularios → `Dialog`
   + `Field`.
   El modal de **Nueva venta** (`app/ventas/page.tsx`) es la referencia de form
   completo: eyebrows en mayúscula, cliente existente/nuevo, ítems desde el
   stock (`equipos`) o libres, y pago dividido con conciliación (faltan/sobran
   /completo + botón «Saldar»).
5. Acciones que "otros usuarios deberían ver" → `publish(...)` de
   `lib/realtime.ts` (ver abajo).
6. `npx tsc --noEmit` antes de terminar.

### Notas por sección

- **Turnos** (`app/turnos/page.tsx`): calendario de los **próximos 7 días**
  (columnas) × **09–20 h** (filas). `Turno` usa `dayOffset` (0 = hoy) + `hora`
  `"HH:00"`; las fechas reales se calculan con `new Date()` en el cliente.
  El color del bloque = `turnoTipo[t.tipo]` (`compra` / `deja` / `retira` /
  `cotizar`). Click en bloque → detalle (+ «Cliente llegó» dispara
  `appointment_arrived`); click en hueco → agendar.
- **Inventario** (`app/inventario/page.tsx`): 3 tabs — **Equipos** (unidades
  únicas por IMEI, con `Equipo.almacenamiento`), **Repuestos** (stock por
  modelo) y **Otros** (`OtroItem`: iPad, AirPods, tablets, accesorios; con
  `cantidad`). Repuestos y Otros tienen **Recuento** (edición inline de
  stock/cantidad + guardar) e **Ingreso** (dialog que suma unidades a un ítem
  existente con cantidad + precio compra, o crea uno nuevo). Equipos tiene
  «Agregar equipo». **Click en una fila de Equipos** abre `EquipoFormDialog`
  (ver + editar todos los campos, incl. `estado`); el mismo dialog con
  `equipo={null}` es el de alta. Los botones de acción van en una toolbar sobre
  la tabla (`ml-auto`), no en el header.
- **Reparaciones** (`app/reparaciones/page.tsx`): 2 tabs — **Tickets** (pipeline
  + tabla) y **Servicios** (`components/servicios-catalogo.tsx`, catálogo
  editable). **No hay sección `/servicios`**, vive acá. El detalle de ticket
  tiene botón **«Recibo de mercadería»** (ver Recibos).
- **Ventas** (`app/ventas/page.tsx`): click en una fila → detalle
  (`VentaDetalle`) con botones **«Comprobante de venta»** y, si hay un pago
  `canje`, **«Recibo de equipo en parte de pago»**. `VentaItem.costoUsd?` y
  `Venta.procedencia?` existen; el costo NO se muestra ni edita en el modal de
  alta.
- **Clientes** (`app/clientes/page.tsx`): tabla (no cards). Fila → ficha con
  historial; toolbar «Nuevo cliente». `clientes` es estado local.
- **Cajas** (`app/cajas/page.tsx`): una sola vista (sin toggle de caja). Arriba,
  3 `StatCard`: **Caja USD** (neto del día en U$), **Caja ARS** (neto en $) y
  **Total (ARS)** (consolidado a la cotización en vivo `useDolar().venta`).
  `MovimientoCaja` tiene `moneda: "usd" | "ars"` y `monto` en esa moneda (la
  caja ARS guarda pesos). Toggle **Del día / Historial**. El botón **«Cerrar
  caja del día»** va **arriba** (toolbar `flex justify-end`), no en el header
  ni abajo.
- **Analíticas** (`app/analiticas/page.tsx`): server component; deriva de
  `ventas` / `equipos`. Además de las 4 originales: facturación por vendedor,
  ingresos por medio de pago, ventas por canal (`procedencia`), equipos por
  estado, y facturación acumulada (SVG). Helper `BarRows`.
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
(Ventas).

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

- No auth real, no tablas de Supabase para datos de negocio.
- No validaciones de formulario avanzadas ni lógica de negocio real todavía.
- No reintroducir formatos de moneda distintos a `fmtUsd`.
- No duplicar cards de stats, títulos de gráfico ni badges de estado: usar
  `StatCard`, `ChartTitle`, `Badge`.
