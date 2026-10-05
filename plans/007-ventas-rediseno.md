# 007 — Ventas: rediseño de lista, detalle y "Nueva venta" + paginación en server

- **Status**: DONE (código + tests; falta la verificación funcional contra
  una org con > 100 ventas, pasos 2–10 de "Verificación")
- **Scope**: `app/(app)/ventas/*`, `lib/db/ventas.ts` (funciones nuevas,
  sin tocar `listVentas`), `lib/ventas.ts` (+ test),
  `lib/date-presets.ts` (+ test). Sin migraciones de schema.
- **Category**: rediseño visual + performance

## Contexto

`ventas-client.tsx` (~2200 líneas) carga **todas** las ventas de la
historia (`listVentas()`) y filtra en el navegador. Problemas detectados con
el usuario:

- Período por defecto "Todas las fechas" → los KPIs muestran totales
  históricos, sin comparación.
- Todas las columnas centradas (`text-center` en cada `th`/`td`), incluido
  texto — contradice la regla global (CLAUDE.md → "Reglas globales de
  tablas").
- Columna "Pago" apila varios chips por fila → filas altas e irregulares.
- Sin ordenamiento, sin paginación, sin indicador de filtros activos.
- Detalle: footer con hasta 5+ botones; "Resumen financiero" con texto de
  9-10 px en tarjetitas de 4 columnas.
- Nueva venta: inputs centrados (incluidos montos), el botón confirmar se
  deshabilita sin decir por qué.
- Varios textos informativos en `text-neutral-400` (no pasa AA).

**Decisiones del usuario**:
1. Alineación: **texto a la izquierda, montos a la derecha**. Esta sección
   es la referencia; las otras 9 secciones centradas se migran después
   (no en este plan).
2. Paginación **clásica** (50 por página, con números de página), filtros
   en la URL.

## Reglas para todo el plan

- Alineación de columnas en **todas** las tablas de Ventas (lista, ítems
  vendidos, ítems del detalle):
  - Texto (Cliente, Detalle/Ítem) → izquierda.
  - Códigos/estados cortos (Venta `V-1042` + fecha, Serie/IMEI, chip de
    Pago) → izquierda.
  - Montos y % (Precio, Costo, Margen, Total, Subtotal) → `text-right
    tabular-nums`.
  - Acciones (íconos) → derecha, columna angosta (`w-px whitespace-nowrap`).
  - Implementación: **sacar** los `text-center` y el `[&_td]:text-center
    [&_th]:text-center` del detalle; la regla global (`th, td {
    text-align:left }`) ya alinea a la izquierda. Solo agregar
    `text-right` en las de montos. La celda vacía "Sin resultados" sigue
    `text-center` (es la excepción documentada).
- `text-neutral-400` solo en íconos decorativos/bordes; todo texto
  informativo a `text-neutral-500` como mínimo (fechas debajo del número
  de venta, "a" del rango, "limpiar fecha", "≈ U$" de Nueva venta, empty
  states).
- Al terminar, actualizar CLAUDE.md → "Reglas globales de tablas": quitar
  Ventas de la lista "Pendiente de resolver" y dejar asentado que la
  decisión es izquierda/derecha (Ventas es la referencia).

## Pasos

### 1. Filtros en la URL + paginación en el server

**URL como fuente de verdad**: `/ventas?preset=mes&desde=&hasta=&vendedor=<id>&tipo=venta&q=&vista=ventas&page=1&sort=fecha&dir=desc`.
- Defaults (cuando falta el param): `preset=mes`, `vista=ventas`,
  `page=1`, `sort=fecha`, `dir=desc`.
- **Filtrar vendedor por id**, no por nombre como hoy
  (`v.vendedor === vendFilter`).
- `?q=` y `?accion=nueva-venta` siguen funcionando (los usa el
  CommandPalette); agregar `?open=<id>` (ver paso 6).

**Server** — `app/(app)/ventas/page.tsx` recibe `searchParams`, los parsea
con un schema `zod` (`lib/ventas-filtros.ts`, puro, con test: params
inválidos → defaults, `page` < 1 → 1, `sort` fuera de la whitelist →
`fecha`) y llama en paralelo:

- `listVentasPagina(filtros)` (nuevo en `lib/db/ventas.ts`) →
  `{ ventas: Venta[]; total: number }`. Supabase `.range(from, to)` con
  `{ count: "exact" }`, `.order(sortColumn, { ascending })`. Sort
  permitido: `fecha`, `total_usd`, `numero`, `margen_pct` (este último solo
  si `rol !== "vendedor"` — si un vendedor lo pide por URL, caer a
  `fecha`). Mismo `VENTA_COLS` y mapeo que `listVentas` (extraer el mapeo
  a una función compartida, no duplicarlo).
- Búsqueda `q` en server: (a) si es numérico → `numero = q`; (b)
  `cliente ilike %q%`; (c) ítems: buscar ids de venta en `venta_items`
  con `detalle ilike %q%` **o** `equipo_id in (ids de equipos con imei
  ilike %q%)`. Combinar con un `.or()` sobre `ventas` (`cliente.ilike…,
  id.in.(…)`). Si la lista de ids es enorme, limitar a 500 y documentarlo.
- `resumenVentas(filtros)` (nuevo) → KPIs del período filtrado **completo**
  (no solo la página): query liviana (`total_usd`, `venta_items(cantidad,
  precio_usd, costo_usd)`) sobre el mismo filtro sin `range`, y los
  números se calculan con funciones puras de `lib/ventas.ts` (con test):
  operaciones, facturado, ticket promedio, `margenPonderado` (plan 006),
  ítems vendidos.
- Mismo `resumenVentas` para el **período anterior** equivalente (helper
  puro `periodoAnterior({desde, hasta})` en `lib/date-presets.ts`, con
  test: "este mes" a la fecha → mismo tramo del mes anterior; rango
  personalizado de N días → los N días previos). Solo si hay rango (si
  `preset=todos`, sin delta).
- Fechas: los rangos se calculan en el server en **hora de Argentina**
  (`America/Argentina/Buenos_Aires`), no con `toISOString()` (UTC), que
  después de las 21 h corre "hoy" al día siguiente — corregir
  `presetRange` o hacer una variante que reciba `hoy` ya ajustado. La
  columna `ventas.fecha` es `timestamptz`: filtrar con límites
  `[desde 00:00 ART, hasta+1 00:00 ART)`.
- Vista "Ítems vendidos": `listItemsVendidosPagina(filtros)` sobre
  `venta_items` con `ventas!inner(...)` para aplicar los mismos filtros de
  venta; paginada igual.
- `listVendedores`, `clientesOpciones`, `equipos`, etc. se siguen cargando
  como hoy (los necesita "Nueva venta"). **No tocar `listVentas()`**: la
  usan Dashboard y Analíticas.

**Cliente** — `ventas-client.tsx` deja de tener `list`/`filtered` como
estado: recibe la página ya filtrada. Cada cambio de filtro hace
`router.replace(nuevaUrl, { scroll: false })` dentro de `startTransition`
y vuelve a `page=1`. El buscador con debounce de 300 ms. Mientras la
transición está pendiente, la tabla baja a `opacity-60` (sin spinner de
página completa).
- Alta y baja de venta → `router.refresh()` en vez de mutar una lista
  local.

**Paginador** — componente nuevo `components/ui/pagination.tsx`
(reutilizable para otras secciones después): "Mostrando 1–50 de 312" a la
izquierda; a la derecha ‹ Anterior · 1 2 3 … 7 · Siguiente › (botones
`Button variant="outline" size="sm"`, página actual con
`border-accent text-accent`, `aria-current="page"`, `aria-label` en las
flechas). Se oculta si hay una sola página. Helper puro
`paginasVisibles(actual, total)` en `lib/pagination.ts` con test.

### 2. KPIs con período y comparación

- 4 `StatCard` como hoy (Operaciones, Facturado, Margen promedio / Ítems
  vendidos para vendedor, Ticket promedio) pero con `delta` contra el
  período anterior (paso 1) y `deltaHint` acorde ("vs mes anterior", "vs
  15 días previos", …). Sin delta si `preset=todos`.
- Margen: `margenPonderado`; "—" si no hay costos cargados (plan 006).
- Arriba de los KPIs, una línea de contexto del período: "Octubre 2026 ·
  del 1 al 4" (formateada en el server).

### 3. Barra de filtros

- Orden: buscador (izq, `md:w-72`) · `Tabs` Ventas/Ítems vendidos ·
  selector de período · vendedor (visible para todos los roles: la lista
  muestra las ventas de toda la org, igual que hoy; se oculta solo si la
  org tiene un único vendedor) · tipo · «Nueva venta» (`ml-auto`).
- **Chips de filtros activos** debajo de la barra cuando hay alguno
  distinto del default: "Vendedor: Caro ×", "Tipo: Reparaciones ×",
  "Búsqueda: «1042» ×" + link "Limpiar todo". Chip = patrón gris de tabla
  (`bg-neutral-100 text-neutral-700 rounded-md px-2 py-0.5 text-xs`) con
  botón × con `aria-label`.
- El filtro "Tipo" pasa a usar los **rubros reales** de los ítems
  (`RUBRO_LABEL`/`categoriaDe` de `lib/ventas.ts`: Equipos, Reparaciones,
  Accesorios, Otros) en vez de `venta.tipo` (venta/reparación), para que
  coincida con Dashboard y Analíticas. En server: `venta_items.categoria`
  (ventas viejas sin categoría → mismo fallback que `categoriaDe`; si eso
  no se puede expresar en SQL limpio, documentar que una venta vieja sin
  categoría solo aparece en "Todas").
- Mobile: se mantiene el botón "Filtros" colapsable, con el contador de
  filtros activos en el botón ("Filtros · 2").

### 4. Tabla de ventas

Columnas (desktop), con la alineación de "Reglas":

| Columna | Contenido |
|---|---|
| Venta | `V-1042` (`font-medium`) + fecha debajo (`text-xs text-neutral-500`) |
| Cliente | nombre, truncado |
| Detalle | ítems unidos con " · ", truncado, `text-neutral-600` |
| Pago | **un solo chip**: el medio principal (el de mayor `montoUsd`) + "+N" si hay más ("Efectivo (pesos) +2"). `title` con el detalle completo usando `montoPagoLabel`. |
| Margen | solo `puedeVerCosto`; `%` o "—" (plan 006). **Se saca la columna Costo** de la lista (queda en el detalle) — con Margen alcanza para escanear. |
| Total | `font-semibold` |
| (acciones) | ícono Imprimir con menú (paso 5) |

- Headers ordenables: Venta (por `numero`), Total, Margen. Click alterna
  `dir`; indicador `ArrowUp`/`ArrowDown` de lucide (h-3 w-3) al lado del
  label; `aria-sort` en el `th`. Los headers ordenables son `<button>`
  dentro del `th` (el estilo global del `th` sigue aplicando).
- Fila completa clickeable → abre el detalle (como hoy) + `cursor-pointer`
  + foco con teclado: `tabIndex={0}` y Enter abre.
- Empty state: si no hay ventas en el período → mensaje + botón «Nueva
  venta»; si hay filtros activos → "Sin ventas para estos filtros" +
  «Limpiar filtros».
- Mobile (`VentaCardMobile`): mismos datos, pago con el mismo chip único
  (se elimina el "Ver más" que expandía métodos).

Vista "Ítems vendidos": mismas reglas; columnas Venta · Cliente · Ítem ·
Serie · Precio · (Margen) · acciones. Sin columna Costo en la lista.

### 5. Detalle de venta

- **Footer** (familia pills con `accent`, ver CLAUDE.md → Dialog):
  izquierda «Eliminar venta» (admin, rojo, como hoy); derecha «Cerrar» +
  **un** botón «Imprimir ▾» que abre un menú chico (`animate-fade-in`,
  cierra con click afuera vía `useOutsideClick`, Esc, navegable con
  flechas) con: Comprobante de venta · Garantía. Máximo 3 botones en el
  footer.
- "Ver compra de canje" **sale del footer** y pasa al bloque de pagos (link
  en la fila del pago en canje).
- **Información general**: se mantiene el grid de `Card` (patrón de
  CLAUDE.md).
- **Ítems**: tabla con la alineación nueva; Costo solo `puedeVerCosto`.
- **"Resumen financiero" → dos bloques legibles** (sin texto < 12 px):
  - *Pagos*: una fila por pago — chip del medio (patrón gris + punto) ·
    caja (`text-neutral-500`) · monto con `montoPagoLabel` a la derecha;
    si hay recargo, debajo "+10 % recargo · cotización $ 1.465"
    (`text-xs text-neutral-500`); si es canje, link «Ver compra de canje».
    Total pagado al pie.
  - *Rentabilidad* (solo `puedeVerCosto`): Costo · Ganancia bruta · Margen
    en una fila de 3 `StatCard` chicos (`align="left"`) o 3 pares
    label/valor en `text-sm`; "—" si `margenPct === null`.

### 6. Deep link `?open=<id>`

`ventas-client.tsx`: leer `searchParams.get("open")`; si la venta está en
la página actual, abrir el detalle; si no, el server la trae aparte
(`getVenta(id)` nuevo en `lib/db/ventas.ts`, pasada como prop
`ventaAbierta`) para poder abrirla aunque no esté en la página/filtro
actual. Al cerrar, sacar el param con `router.replace` (como `accion`).
Lo usa el plan 005 (dashboard → ventas recientes).

### 7. Nueva venta

- **Alineación**: sacar `text-center` de los inputs/selects y de los
  `Field` (`labelClassName="text-center"`) y de `Eyebrow`; montos con
  `text-right tabular-nums`.
- **Por qué no se puede confirmar**: cuando `!valid`, mostrar en el footer
  (a la izquierda del botón, `text-sm text-neutral-500`, con
  `aria-live="polite"`) el **primer** motivo pendiente, en este orden:
  "Elegí un cliente" · "Agregá al menos un ítem" · "Hay un ítem sin
  precio" · "Faltan U$ 120 por cobrar" / "Sobran U$ 30" · "Falta cargar
  el equipo del canje". Lógica pura `motivoNoConfirmable(...)` en
  `lib/ventas.ts` con test (reusar `calcularRestante`).
- **Teclado**: en `ItemBuscador`, flechas para moverse y Enter agrega el
  resaltado (el primero por defecto); Esc cierra. Después de agregar,
  el foco vuelve al buscador para cargar el siguiente.
- El campo Vendedor ya viene resuelto por el plan 006 (fijo para no
  admin).

## Qué NO construir

- No migrar la alineación de las otras 9 secciones (otro plan).
- No cambiar `listVentas()` ni lo que consumen Dashboard/Analíticas.
- No agregar edición de ventas.
- No exportar a CSV/Excel (puede ser un plan aparte).

## Verificación

1. `npx tsc --noEmit` y `npx vitest run` (tests nuevos: parseo de filtros,
   `periodoAnterior`, `paginasVisibles`, `motivoNoConfirmable`, funciones
   de resumen).
2. Con una org con > 100 ventas: la página carga 50, "Mostrando 1–50 de
   N", navegar páginas, ordenar por Total y Margen, recargar la página y
   compartir la URL → mismo estado.
3. Filtros: cada uno cambia la URL, vuelve a página 1, aparece su chip;
   "Limpiar todo" vuelve a los defaults. `?q=1042` desde el CommandPalette
   sigue encontrando la venta.
4. KPIs: con "Este mes" muestran delta vs el mismo tramo del mes anterior;
   coinciden con un `select sum(total_usd)` hecho a mano con
   `execute_sql` para ese rango (en hora Argentina).
5. Probar a las 22 h hora Argentina (o mockeando `hoy`): "Este mes" no
   incluye ni excluye un día de más.
6. Vendedor: no ve columna Margen ni puede ordenar por margen vía URL.
7. Detalle: footer con ≤ 3 botones; menú Imprimir con teclado; pagos en
   pesos con el monto del snapshot (plan 006).
8. Nueva venta: cada motivo de bloqueo aparece en el footer; cargar 3
   ítems solo con teclado.
9. Capturas a 1366, 1920 y 390 px: sin overflow horizontal de la página,
   tabla con scroll propio si no entra.
10. `grep -n "text-center" "app/(app)/ventas/"` → solo celdas vacías
    "Sin resultados". `grep -n "text-neutral-400"` → solo íconos/bordes.
11. Actualizar CLAUDE.md (Ventas: filtros en URL, paginación, `?open=`,
    alineación como referencia; nuevo primitivo `Pagination` en "Otros
    primitivos").
