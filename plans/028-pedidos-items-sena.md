# 028 — Pedidos de la Agenda: varios productos, precio, seña y saldo

**Status:** HECHO en código (25/11) — falta aplicar la migración
`20261126100000_pedidos_items_sena` y verificar en el navegador.

**Scope:** en Agenda → «Nuevo pedido» / «Editar pedido» (`PedidoDialog`), el
pedido deja de ser un único texto («Qué se pidió») y pasa a ser una **tabla de
productos** (varios a la vez), cada uno con su **precio de venta**. Además se
registra si el cliente **abonó seña** y **cuánto**, y se muestra el **total**,
la **seña** y el **saldo por abonar** (calculado solo: total − seña). El
detalle (`PedidoDetalle`) y el chip del calendario reflejan esos datos.

**Fuera de alcance (no hacer):** que la seña genere un movimiento de caja o de
cuenta corriente, convertir el pedido en venta al entregarlo, vincular ítems al
stock (`celulares`/`otros`), cotizaciones en pesos, reportes de pedidos en
Analíticas. Quedan anotados como pendientes al final.

Leer antes: `CLAUDE.md` (secciones «Agenda», «Backend y multi-tenancy» —RLS,
estructuras anidadas en `jsonb`—, «Moneda», «`Dialog`: footer…», «Modo
formulario», «Reglas globales de tablas», «Testing») y este plan entero.

## Estado actual (para ubicarse)

- Tabla `pedidos` (`supabase/migrations/20261124180000_pedidos.sql`):
  `cliente`, `cliente_id`, `descripcion text not null` (check no vacío),
  `fecha_entrega`, `estado`, `nota`. RLS + grants + default de
  `organization_id` ya están.
- `lib/db/pedidos.ts` (`toPedido`, `createPedido`, `updatePedido`, …),
  `Pedido` en `lib/types.ts` (~línea 224).
- `app/(app)/agenda/actions.ts`: `PedidoInput` + `pedidoDatosDe` (~línea 93).
- UI: `components/agenda/pedido-dialog.tsx` (`PedidoDialog` y
  `PedidoDetalle`), `components/agenda/pedido-chip.tsx` (usa
  `pedido.descripcion` en `title` y texto), `app/(app)/agenda/agenda-client.tsx`
  (~línea 372, confirm de eliminar usa `descripcion`).
- Hoy la seña «va en la nota» (texto libre). Este plan la vuelve un dato.

## Decisiones (no re-decidir)

1. **Ítems como `jsonb`** en `pedidos.items` (snapshot embebido, mismo
   criterio que `Turno.pagos`/`Compra.items` — ver CLAUDE.md «Estructuras
   anidadas»). No hace falta tabla propia: no se agrega en SQL por ítem.
   Shape: `PedidoItem = { detalle: string; cantidad: number; precioUsd: number }`.
2. **Moneda: U$** (como toda la app). Precio unitario en USD, total por fila =
   `precioUsd × cantidad`. Todo se muestra con `fmtUsd`, nunca a mano.
3. **Seña**: columna `sena_usd numeric(12,2) not null default 0` (`0` = no
   abonó). En la UI: checkbox **«Abonó seña»**; al tildarlo aparece el campo
   «Monto de la seña (U$)». Destildar = seña 0. No se guarda medio de pago ni
   caja (fuera de alcance; la nota sigue disponible para aclarar el medio).
4. **Total y saldo son calculados, no columnas** (mismo criterio que los
   contadores de Clientes: nunca se desincronizan). `totalPedido(items)` y
   `saldoPedido(items, senaUsd)` en `lib/pedidos.ts` (puro, con test).
5. **Validación** (pura, `errorPedido(...)` en `lib/pedidos.ts`, la usan el
   dialog y la server action — el server **revalida**, nunca confía en el
   cliente): al menos 1 ítem; cada ítem con `detalle` no vacío, `cantidad`
   entero ≥ 1, `precioUsd` ≥ 0 (finito); `senaUsd` ≥ 0 y **≤ total**. Filas
   totalmente vacías (sin detalle ni precio) se descartan antes de validar
   (`limpiarItems`), así la fila vacía de «agregar» no rompe.
6. **`descripcion` se mantiene** (la columna es `not null` y la usan el chip,
   el confirm de borrar y los pedidos viejos) pero **se deriva** de los ítems
   en el server: `descripcionPedido(items)` →
   `"iPhone 15 Pro 256 GB"` con 1 ítem, `"2× Funda MagSafe"` si cantidad > 1,
   `"iPhone 15 Pro 256 GB + 2 más"` con 3 ítems. El usuario ya no la escribe.
7. **Pedidos viejos** (antes de esta migración): `items = '[]'` y
   `sena_usd = 0`. Al abrirlos en edición, el dialog arranca con **una fila**
   con `detalle = pedido.descripcion`, cantidad 1 y precio vacío (obliga a
   cargar precio antes de guardar). En el detalle, si `items` está vacío se
   muestra `descripcion` como hoy, sin tabla ni totales.
8. Un pedido **cancelado** no cambia nada de seña (se ve igual en el detalle;
   devolverla o no es algo del negocio, se aclara en la nota).

## Cambios

### 1. Migración — `supabase/migrations/20261126100000_pedidos_items_sena.sql`

```sql
alter table public.pedidos
  add column items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(items) = 'array'),
  add column sena_usd numeric(12,2) not null default 0
    check (sena_usd >= 0);
```

Sin backfill (Decisión 7). Las policies/grants existentes ya cubren las
columnas nuevas. Aplicar con `mcp__plugin_supabase_supabase__apply_migration`
(proyecto `tekly`, `xdfdrzxrmfpnezyeeaeq`) **solo con el OK del usuario**;
después `get_advisors` tipo `security` (no debería aparecer nada nuevo).

### 2. Lógica pura — `lib/pedidos.ts` + `lib/pedidos.test.ts` (nuevos)

- `limpiarItems(items)`, `totalPedido(items)`, `saldoPedido(items, senaUsd)`
  (nunca negativo: `Math.max(0, …)`), `descripcionPedido(items)`,
  `errorPedido({ items, senaUsd })` → `string | null` (mensajes en castellano:
  «Agregá al menos un producto.», «Falta el detalle del producto 2.»,
  «La seña no puede superar el total.», …).
- Redondeo a centavos en total/saldo (evitar `0.1 + 0.2`).
- Tests: total con cantidades, saldo con/sin seña, seña = total → saldo 0,
  seña > total → error, filas vacías descartadas, precio negativo/NaN → error,
  `descripcionPedido` con 1/2/3+ ítems y cantidad > 1.

### 3. Tipos — `lib/types.ts`

- `PedidoItem` (Decisión 1) y en `Pedido`: `items: PedidoItem[]`,
  `senaUsd: number`. Actualizar el comentario del tipo.

### 4. Datos — `lib/db/pedidos.ts`

- `COLS` + `items, sena_usd`; `PedidoRow` + `items: PedidoItem[] | null`,
  `sena_usd: number | string`; `toPedido` mapea (`items ?? []`,
  `Number(sena_usd)`).
- `PedidoDatos`: sacar `descripcion` como input del usuario; agregar
  `items`, `senaUsd`. `columnas(d)` escribe `items`, `sena_usd` y
  `descripcion: descripcionPedido(items)`.

### 5. Server actions — `app/(app)/agenda/actions.ts`

- `PedidoInput`: `{ cliente, items: PedidoItem[], senaUsd: number, fechaEntrega, nota }`
  (sin `descripcion`).
- `pedidoDatosDe`: `limpiarItems` → `errorPedido` (throw con el mensaje) →
  normalizar números (cantidad entera, precios con 2 decimales) → resto igual
  (cliente, fecha). Siguen `requireEscritura()` + `revalidatePath("/agenda")`.

### 6. Dialog — `components/agenda/pedido-dialog.tsx` (`PedidoDialog`)

Sigue siendo `Dialog formulario`. Subir a `size="2xl"` (la tabla necesita
ancho; ver regla de CLAUDE.md: ensanchar antes que alargar). Orden:

1. `GrillaCampos`: Cliente (`ClientePicker allowLibre`, `sm:col-span-2`) +
   Fecha de entrega (igual que hoy).
2. Eyebrow **«PRODUCTOS»** (mismo estilo que `Eyebrow` de Nueva venta) y una
   **tabla editable** (`<table>` dentro de un contenedor `overflow-x-auto`
   `rounded-lg border`; headers con el estilo global, no poner clases):
   columnas **Producto** (`Input`, `text-start`), **Cant.** (`Input
   type="number"`, angosto), **Precio unit. (U$)** (`Input type="number"`),
   **Subtotal** (`fmtUsd`, `tabular-nums`, solo lectura) y una columna de
   acción con `IconButton` `Trash2` (`aria-label="Quitar producto"`,
   `variant="danger-ghost"`, deshabilitado si queda una sola fila).
   Debajo, `Button variant="tonal" icon={Plus} size="sm"` **«Agregar
   producto»** que suma una fila vacía y le da foco al input de Producto.
   Enter en el último precio también agrega fila (opcional, si sale fácil).
   Los inputs de números van centrados (como la tabla); usar `!text-center`
   si el modo formulario los alinea a la izquierda.
3. Bloque **seña**: checkbox «Abonó seña» (centrado, como los checkboxes del
   modo formulario) y, si está tildado, `Field` «Monto de la seña (U$)».
4. **Resumen** (card chica `rounded-lg border bg-white/70 p-3`, 3 columnas):
   **Total**, **Seña**, **Saldo por abonar** — `fmtUsd`, `tabular-nums`,
   el saldo en `font-semibold`. Se recalcula en vivo con `totalPedido`/
   `saldoPedido` (nada inline).
5. `Field` «Nota» (igual; cambiar placeholder a «Proveedor, color
   alternativo, medio de la seña…»).

Estado: `items` como array de filas en strings (para que el input pueda
quedar vacío) + conversión a números al enviar. `valido` = cliente +
fecha + `errorPedido(...) === null`; mostrar el error de `errorPedido` debajo
del resumen solo después de tocar algo (o al intentar guardar), en
`text-sm text-red-600` como el error actual. Edición de pedido viejo:
Decisión 7. El reset al reabrir ya lo maneja el `key` en `agenda-client.tsx`
(verificarlo; si no, agregar `key` con fallback propio, p. ej.
`"pedido-none"`).

### 7. Detalle — `PedidoDetalle` (mismo archivo)

- Reemplazar «Qué se pidió» por una tabla de solo lectura (Producto / Cant. /
  Precio / Subtotal; columna Producto `text-start`) + el mismo resumen
  Total / Seña / Saldo por abonar. Si `items` está vacío (pedido viejo),
  dejar el texto `descripcion` como hoy.
- Si `senaUsd === 0` mostrar «Sin seña» en el lugar de la seña.

### 8. Chip y otros usos

- `pedido-chip.tsx`: el texto sigue usando `descripcion` (ahora derivada). En
  el `title` agregar ` · Saldo ${fmtUsd(saldo)}` cuando hay ítems.
- `agenda-client.tsx` (~372): sin cambios (usa `descripcion`).
- Buscar otros usos con `grep -rn "PedidoInput\|createPedido\|descripcion" app/(app)/agenda components/agenda lib` y ajustar tipos.
- `lib/agenda.test.ts`: los fixtures de `Pedido` necesitan `items: []`,
  `senaUsd: 0`.

### 9. Ayuda y docs

- `content/ayuda/turnos/pedidos.mdx`: explicar tabla de productos, seña y
  saldo; subir `actualizado`. Capturas solo con datos demo.
- `CLAUDE.md`, sección «Agenda» → párrafo **Pedidos**: columnas `items`
  (jsonb `PedidoItem[]`) y `sena_usd`; total/saldo calculados en
  `lib/pedidos.ts`; `descripcion` derivada; sacar «la seña va en la nota».
- `plans/README.md`: fila 028 + Status de este archivo al terminar.

## Verificación

1. `npx tsc --noEmit` y `npx vitest run` en verde.
2. Migración aplicada (con OK del usuario) + `get_advisors` security sin
   novedades.
3. En el navegador con sesión (pedirle al usuario que se loguee en el panel;
   **no tipear contraseñas**): Agenda → hueco de «Todo el día» → Nuevo
   pedido con 3 productos (uno con cantidad 2), seña parcial → el resumen
   muestra total/seña/saldo correctos; seña > total bloquea guardar; guardar
   → chip en el calendario con la descripción derivada; abrir el detalle →
   tabla + saldo; editar un pedido viejo (sin ítems) → arranca con la fila
   precargada. Crear datos reales solo con OK del usuario y borrarlos al
   final si lo pide. Probar el dialog a 390 px (tabla con scroll horizontal,
   sin desbordar). Sin errores en consola.
4. `graphify update .` si está instalado.

## Cuidado

- `agenda-client.tsx`, `lib/types.ts` y `CLAUDE.md` los editan otras
  sesiones: releer justo antes de cada edición, cambios chicos y puntuales.
- No commitear sin que el usuario lo pida. No `git stash` ni `checkout`.
- `fmtUsd` para todo monto; números `tabular-nums`; nada de
  `text-neutral-400` para texto.

## Pendientes (para un plan futuro, no ahora)

- Registrar la seña como ingreso en una caja (medio + caja, como un pago de
  Nueva venta) y descontarla al convertir el pedido en venta.
- «Convertir en venta» al marcar Entregado (precargar Nueva venta con los
  ítems y la seña como pago ya cobrado).
- Vincular ítems a variantes/stock cuando el pedido llega.
