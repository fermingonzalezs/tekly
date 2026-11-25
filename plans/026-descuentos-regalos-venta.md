# 026 — Descuento de la venta e ítems de regalo

**Status:** HECHO en código (2026-11-25). La migración base `20261125150000_ventas_descuento_regalo.sql` está **aplicada** (descuento_usd + regalo por ítem). También **aplicada** `20261125170000_ventas_ajuste_regalo.sql` (renombrada desde `…160000…` porque chocaba con `compras_canje_equipo`): `ventas.ajuste_usd` (firmado) y `ventas.regalo`. Falta verificar en el navegador. Lógica pura en `lib/ventas.ts` («Descuento de la venta y regalos» + `aplicarAjusteVenta`) con tests en `lib/ventas-descuento.test.ts` y `lib/ventas.test.ts`.

**Scope:** en **Nueva venta**, (a) un **descuento sobre el total** de la venta (ej. −U$ 5, −U$ 10, o un %), y (b) marcar un ítem como **regalo** (funda, cargador: precio 0, sale igual de la venta y de los recibos). Se ve en la lista, el detalle, los recibos/garantía, y entra bien en margen, KPIs y Analíticas.
**Fuera de alcance:** descuento por ítem (solo total de la venta), editar una venta ya creada (hoy no existe), cupones/códigos, descuento máximo por rol, descontar stock de «Otros» al vender (hoy ningún ítem `otro` descuenta stock — no cambiarlo acá, anotarlo como pendiente).

Leer antes: `CLAUDE.md` (sobre todo «Ventas», «Moneda», «`Dialog`», «Recibos / PDFs», «RLS — reglas de oro», «Testing») y el modal `NuevaVentaDialog` en `app/(app)/ventas/ventas-client.tsx`.

## Orden de trabajo (lo que falta)

1. Test del caso borde de «Lógica pura» + `motivoNoConfirmable` (con tests).
2. Migración (aplicar + advisors).
3. Tipos + `lib/db/ventas.ts` + `createVentaAction`.
4. `NuevaVentaDialog`.
5. Lista, Ítems vendidos, `VentaDetalle`, recibo y garantía.
6. Demo.
7. Ayuda + `CLAUDE.md` + `plans/README.md` + Status.
8. Verificación.

## Cómo es hoy

- `VentaItem` (`lib/types.ts`) = `{ detalle, cantidad, precioUsd, costoUsd?, celularId?, notebookId?, categoria?, repuestos? }`, tabla `venta_items`.
- `NuevaVentaDialog`: `totalPrecio = Σ cantidad × precioUsd` (línea ~2238); con eso concilia pagos (`calcularRestante`), arma el botón «Confirmar venta · U$ …» y manda `totalUsd: totalPrecio` + `margenPct` a `crearVenta`. La rentabilidad en vivo es `margenVenta(itemsConCosto)` + `RentabilidadEnVivo` (solo `puedeVerCosto`).
- `motivoNoConfirmable` (`lib/ventas.ts`) rechaza `precioUsd <= 0` («Hay un ítem sin precio») → hoy un regalo no se puede cargar.
- `createVenta` (`lib/db/ventas.ts`) **confía en `totalUsd`/`margenPct` del cliente** y los inserta tal cual.
- Margen/ganancia se calculan **siempre desde los ítems** (`margenVenta`, `margenPonderado`, `gananciaTotal`, `margenPorTipo` en `lib/analiticas.ts`, `ventasPorRubro`, resumen mensual, dashboard), no desde `ventas.total_usd`.
- La demo (`lib/demo/operaciones.ts` → `crearVentaDemo`, `lib/demo/ventas-query.ts`) reusa `VentasClient` con `acciones` propias.

## Decisiones (no re-decidir)

1. **El descuento se prorratea en los ítems al guardar.** `venta_items.precio_usd` pasa a ser el **precio efectivo** (ya con su parte del descuento) y se agrega `venta_items.precio_lista_usd` (nullable: solo cuando el descuento tocó ese ítem). Así **todo lo que suma desde los ítems** (margen, ganancia, Analíticas, dashboard, resumen mensual, rubros) queda correcto **sin tocarlo**, y `Σ precio_usd × cantidad = total_usd` sigue valiendo.
2. `ventas.descuento_usd numeric not null default 0 check (descuento_usd >= 0)` guarda el descuento total (para mostrarlo y para la columna/recibo). Si se cargó en %, se guarda el **monto en USD resultante** (el % es solo una ayuda de carga; opcionalmente `descuento_pct numeric` nullable solo para mostrar «10 %» — hacelo solo si sale simple).
3. **Prorrateo:** proporcional al subtotal de cada ítem (`cantidad × precio lista`), centavos exactos, el resto de redondeo al ítem más caro (mismo criterio que `prorratearCostos` en `lib/compras.ts`). Los regalos (precio 0) no reciben descuento. El precio unitario efectivo puede quedar con centavos (`descuentoLinea / cantidad`); redondear a centavos y que la suma cierre exacta (si con `cantidad > 1` no cierra por centavos, el ítem que absorbe el resto debe ser uno con `cantidad = 1` o ajustar como mejor cierre — que el test lo cubra).
4. **Descuento ≤ subtotal** (sin ítems de regalo). Un descuento que deja el total en 0 no se permite (si regalan todo, es otra cosa). Validar en el cliente (`motivoNoConfirmable`) **y** en el server.
5. **Regalo = flag por ítem** `venta_items.regalo boolean not null default false`. Un regalo tiene `precio_usd = 0` forzado (el server lo pisa, no confía), **conserva su `costoUsd`** (el costo del regalo baja la ganancia de la venta — es lo correcto) y no cuenta en `motivoNoConfirmable` como «ítem sin precio». Una venta tiene que tener **al menos un ítem que no sea regalo**. Un celular/notebook del stock **no** puede ser regalo (no mostrar la opción en esos ítems); sí servicio, otro y libre.
6. **El server recalcula** total, precios efectivos y margen: `createVentaAction`/`createVenta` reciben los ítems con **precio de lista** + `regalo` + `descuentoUsd`, llaman a la función pura (abajo) y persisten lo que devuelve. `totalUsd` y `margenPct` del cliente se ignoran (o se comparan y se rechaza si difieren en más de 1 centavo — elegí recalcular e ignorar). La conciliación de pagos del server, si existe, contra el total recalculado.
7. Ventas viejas: `descuento_usd = 0`, `regalo = false`, `precio_lista_usd = null` → se ven igual que hoy. Sin backfill.

## Lógica pura — `lib/ventas.ts` (tests en `lib/ventas-descuento.test.ts`)

- `aplicarDescuentoVenta(items: {cantidad, precioUsd, regalo?}[], descuentoUsd): { items: {precioUsd (efectivo), precioListaUsd?: number}[]; subtotalUsd; descuentoUsd; totalUsd }` — precio de regalo → 0; prorrateo según Decisión 3; `precioListaUsd` solo si el precio cambió.
- `descuentoDesdePct(subtotal, pct)` → USD redondeado a centavos.
- `errorDescuento(subtotal, descuentoUsd)` → mensaje o `null` (negativo, mayor o igual al subtotal).
- **Ya hecho — leer antes de usarla:** si el descuento no se puede repartir en centavos exactos (ej. 3 × U$ 10 con U$ 1 de descuento y ninguna línea de cantidad 1), la función aplica lo que puede (U$ 0,99) y lo informa en `resultado.descuentoUsd`. Por eso **la UI muestra y el server persiste siempre `resultado.descuentoUsd` y `resultado.totalUsd`**, nunca el descuento tipeado. Falta un test de este caso (`descuentoUsd` < pedido y `Σ precioUsd × cantidad = totalUsd`).
- Un regalo vuelve como `{ precioUsd: 0 }` **sin** `precioListaUsd`: no se guarda cuánto valía. Está bien así; en recibo y detalle sale «Regalo» en vez de un monto.
- `motivoNoConfirmable` (falta): aceptar `regalo` en los ítems (no exigir precio en regalos), exigir ≥ 1 ítem no regalo, validar el descuento, y conciliar contra el **total con descuento**.
- Tests: sin descuento (no cambia nada, sin `precioListaUsd`), U$ 10 sobre 1 ítem, sobre 3 ítems con distintos precios (suma exacta), con `cantidad > 1`, con un regalo en la lista (no recibe descuento), descuento = subtotal (error), descuento en %, margen de `margenVenta` sobre los ítems resultantes (el regalo con costo baja la ganancia).

## Base — `supabase/migrations/2026112515xxxx_ventas_descuento_regalo.sql`

```sql
alter table public.ventas add column descuento_usd numeric not null default 0 check (descuento_usd >= 0);
alter table public.venta_items
  add column regalo boolean not null default false,
  add column precio_lista_usd numeric check (precio_lista_usd is null or precio_lista_usd >= 0);
alter table public.venta_items add constraint venta_items_regalo_sin_precio check (not regalo or precio_usd = 0);
```

Aplicar con MCP `apply_migration` (proyecto `xdfdrzxrmfpnezyeeaeq`, tools `mcp__plugin_supabase_supabase__*`) y después `get_advisors` tipo `security`: no debe aparecer nada nuevo. Las tablas ya tienen RLS/grants; columnas nuevas no los necesitan.

## Server

- `lib/types.ts`: `VentaItem.regalo?: boolean`, `VentaItem.precioListaUsd?: number`; `Venta.descuentoUsd?: number`.
- `lib/db/ventas.ts`: `VENTA_COLS` (línea ~70) + `descuento_usd` y en `venta_items(...)` + `regalo, precio_lista_usd`; `ITEM_COLS` (línea ~486, Ítems vendidos) + `regalo, precio_lista_usd`; `toVenta`/`toVentaItem` los mapean; `CreateVentaInput.descuentoUsd`; `createVenta` usa `aplicarDescuentoVenta` y persiste `total_usd`, `descuento_usd`, `margen_pct` (`margenVenta(...) ?? 0`, mismo criterio que hoy) y por ítem `precio_usd` efectivo, `precio_lista_usd`, `regalo`. Revisar `listItemsVendidosPagina` (select propio, línea ~487) y cualquier otro select de `venta_items` que deba traer `regalo`.
- `app/(app)/ventas/actions.ts` (`createVentaAction`): pasar `descuentoUsd`, validar con `errorDescuento` (tira si hay error), forzar `precioUsd = 0` en regalos y rechazar regalo en un ítem con `celularId`/`notebookId`.
- Demo: `crearVentaDemo` usa la misma `aplicarDescuentoVenta` (no tiene server; que el estado guardado sea el mismo shape).

## UI — `NuevaVentaDialog` (`app/(app)/ventas/ventas-client.tsx`)

- Por ítem (no celular/notebook): checkbox o toggle **«Regalo»** en la fila. Al tildarlo, el precio pasa a 0 y el input queda deshabilitado mostrando «Regalo»; al destildar vuelve al precio de lista que tenía (guardar el anterior en el draft). Un chip/etiqueta «Regalo» visible en la fila. Mantener las reglas de `aria-label` (input/checkbox sin label visible) y que no se desborde en mobile (probar a 360 px).
- Bajo la lista de ítems, antes del **Total**: fila **«Descuento»** con un `Select` U$ / % + `Input` numérico (sin flechas, ya ocultas globalmente). Mostrar **Subtotal**, **Descuento −U$ X** (o «−10 % · U$ X») y **Total** (el `accent-soft` de hoy). Error inline si el descuento es inválido.
- `totalPrecio` → el total **con descuento** (pagos, «Saldar», botón «Confirmar venta · U$ …», `motivoNoConfirmable`). La rentabilidad en vivo usa los ítems ya prorrateados (`aplicarDescuentoVenta` + `costoUnitarioItem`).
- Enviar a `crearVenta` los ítems con precio **de lista** + `regalo` + `descuentoUsd`.

## UI — dónde se ve después

- **Lista** (tabla y `VentaCardMobile`): `Total` sigue siendo `totalUsd`; si `descuentoUsd > 0`, una línea chica debajo «−U$ 10 desc.» (`text-[11px] text-neutral-500`, `tabular-nums`). Ítems vendidos: el ítem regalo muestra chip «Regalo» (patrón chip gris + punto de `CLAUDE.md`) y precio `U$ 0`; un ítem con `precioListaUsd` muestra el precio efectivo (es el que da la ganancia) con el de lista chico debajo.
- **Ojo con el recibo de venta**: hoy arma las líneas con `i.precioUsd` (`ventas-client.tsx` ~496). Después de este cambio ese es el precio **efectivo**: usar `precioListaUsd ?? precioUsd` para la línea, y el descuento como ajuste aparte.
- **`VentaDetalle`**: en la tabla de ítems, regalo con chip «Regalo»; si hay `precioListaUsd`, mostrar el precio de lista y el efectivo (o el de lista con el descuento aparte — elegí lo más claro). Antes del Total: **Subtotal** y **Descuento**.
- **Recibo de venta y garantía** (`components/recibos/recibo.tsx`, uso en `ventas-client.tsx` ~490–510): líneas al **precio de lista**, el regalo con «Regalo» en la columna de monto (`montoLabel`), y antes del total una fila/bloque «Descuento −U$ X» cuando corresponda. Si `ReciboLineas` no soporta filas de ajuste, agregarle una prop opcional (`ajustes?: { label, montoUsd }[]` que se dibuja entre las líneas y el total) sin romper los otros usos (Reparaciones, Compras). La garantía incluye los regalos (tienen garantía como cualquier ítem) — confirmá que `garantiaContenido(items)` no los filtre por precio.
- **Ayuda:** `content/ayuda/ventas/nueva-venta.mdx` (descuento y regalo, cómo afecta el margen) y `content/ayuda/ventas/guia.mdx` si lista los campos. Fecha `actualizado`.
- **CLAUDE.md** → sección «Ventas»: un párrafo con las Decisiones 1, 5 y 6 (prorrateo en ítems, `precio_lista_usd`, regalo con costo, server recalcula).

## Verificación

1. `npx tsc --noEmit` y `npx vitest run` en verde.
2. Navegador (`preview_start` con la config de `.claude/launch.json`, puerto 3100; si el panel no tiene sesión, pedirle al usuario que se loguee en el panel — **no tipear contraseñas**): crear una venta con 2 ítems + un regalo con costo + descuento U$ 10, pagar, confirmar; revisar lista, detalle, recibo y garantía (impresión), y que el margen del detalle baje por el regalo y el descuento. **Crear datos en la base real requiere OK del usuario** antes; si no lo da, probar solo el modal sin confirmar.
3. La demo `/demo/ventas`: misma venta, sin errores de hidratación en consola.
4. Probar el modal a 360 px.
5. `graphify update .` si está instalado.
6. Actualizar `plans/README.md` (fila 026) y el Status de este archivo. **No commitear** sin que el usuario lo pida.

## Cuidado

- La primera sesión que tomó este plan se cortó por límite de uso después de la lógica pura. Antes de seguir, `git diff` de `lib/ventas.ts`, `lib/types.ts`, `lib/db/ventas.ts` y `ventas-client.tsx` para confirmar que no quedó nada a medias de este plan.
- `ventas-client.tsx` y `lib/ventas.ts` los toca seguido otra gente: releer el archivo justo antes de editar, ediciones chicas y puntuales, no reescribir bloques enteros.
- No usar `toLocaleString`/«USD» a mano: `fmtUsd`.
- No recalcular montos persistidos con la cotización de hoy.
