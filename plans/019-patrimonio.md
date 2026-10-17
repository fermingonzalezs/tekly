# 019 — Estado de situación patrimonial («Patrimonio»)

**Status:** HECHO — **Fase 1** (foto a hoy) y **Fase 2** (historial mensual con fotos diarias, 2026-10-17). Ver «Informe de ejecución» y «Fase 2 · implementación» al final.
**Scope:** sección nueva **Patrimonio** (solo admin) que muestra, a hoy, qué tiene y qué debe el negocio: caja, cuentas por cobrar, inventario, anticipos a proveedores y saldos a favor de clientes → **patrimonio neto**. Fase 1 = foto de hoy, sin tablas nuevas. Fase 2 = evolución histórica (snapshots diarios).

## Qué es (y qué no es)

Un balance **gerencial simplificado**, no contable: sirve para que el dueño responda «¿cuánto vale mi negocio hoy y de qué está hecho?». No incluye impuestos, sueldos, amortizaciones ni cuentas a pagar a proveedores (Tekly no las modela: las compras a proveedor se pagan **al cargarlas**, el egreso sale de la caja en ese momento). Hay que decirlo en la propia pantalla («Balance gerencial, no reemplaza al de tu contador»).

## Modelo (qué entra en cada línea)

```
ACTIVO
  1. Disponibilidades      saldo de cada caja (movimientos_caja), caja USD tal cual,
                           caja ARS convertida con la cotización de hoy
  2. Créditos              cuentas corrientes con saldo > 0 (clientes que deben)
  3. Bienes de cambio      inventario a COSTO: celulares + notebooks (no vendidos ni
                           extraviados) + repuestos (stock × costo) + otros (otroValorStock)
  4. Anticipos a proveedores   compras a proveedor en estado «pendiente» (ya pagadas
                           desde caja, la mercadería todavía no llegó)
PASIVO
  5. Saldos a favor de clientes   cuentas corrientes con saldo < 0 (le debemos mercadería/plata)
PATRIMONIO NETO = Activo − Pasivo
```

**Memo (se muestra aparte, NO suma al total):**
- Valor del inventario **a precio de venta** y margen potencial (`precioUsd` − `costoUsd`).
- Trabajos en curso: tickets abiertos con `presupuestoUsd` (dinero que se espera cobrar al entregar; no es un derecho todavía).
- Celulares/notebooks «extraviados» a costo (pérdida potencial), y cantidad de ítems **sin costo cargado** (el total de inventario es un piso, no un valor exacto).
- Movimientos de caja ARS **sin cotización** y cajas inactivas con saldo ≠ 0.

## Decisiones tomadas (proponer al dueño, fáciles de cambiar)

1. **Inventario a costo**, no a precio de venta (criterio conservador; el precio de venta va como memo).
2. **Cotización**: blue **venta** de hoy (la que ya usa Ventas), traída **en el server** con `fetch` a dolarapi.com + `revalidate: 300` y fallback (`lib/dolar.ts` hoy es solo cliente). El cálculo es 100 % server-side → no hay problema de hidratación. Se muestra «Cotización usada: $ X · actualizada hh:mm» en la cabecera. Es una **valuación a hoy** (distinto de los montos persistidos, que nunca se recalculan).
3. **Canje**: ya no es una caja (plan 020). El equipo recibido entra directo a inventario a su valor de canje, así que cuenta **una sola vez** como inventario a costo y no hay nada que excluir. **Depende del plan 020**: mientras exista una caja de medio `canje`, `armarPatrimonio` debe ignorarla (y listarla en el memo `canjeEnCaja`) para no contar dos veces; al ejecutarse el 020 esa excepción se borra.
4. **Extraviado** no cuenta como activo (hoy `InventarioValor` solo excluye `vendido`: unificar criterio, ver Parte C).
5. Solo **admin** (`requireRole("admin")` en `page.tsx` + `roles: ["admin"]` en `lib/nav.ts`); información sensible de costos/saldos. Técnico y vendedor no la ven ni por URL.
6. Ruta **`/patrimonio`**, dentro de la categoría Finanzas del TopNav (junto a Cajas, Analíticas, Cuentas corrientes).

## Parte A — Lógica pura (`lib/patrimonio.ts` + `lib/patrimonio.test.ts`)

Sin Supabase, sin `window`. Reusar lo que ya existe, no reimplementar: `saldoPorCaja`/`netoMovimientos` (`lib/cajas.ts`), `saldoDe` (`lib/cuentas-corrientes.ts`), `otroValorStock` (`lib/otros.ts`).

```ts
armarPatrimonio({
  cotizacion,                  // blue venta, ARS por USD
  cajas, movimientos,          // todas, activas e inactivas
  movimientosCC, clientes,
  celulares, notebooks, repuestos, otros,   // notebooks: si el plan 018 ya está hecho; si no, omitir
  compras, tickets,
}): Patrimonio
```
Devuelve un objeto serializable:
`{ activo: { total, disponibilidades: { total, cajas: [{ id, nombre, moneda, medio, saldo, enUsd }] }, creditos: { total, cantidadClientes, top: [{ clienteId, nombre, saldo }] }, inventario: { total, porCategoria: [{ label, valor, unidades, sinCosto }] }, anticipos: { total, cantidad } }, pasivo: { total, saldosAFavor: { total, cantidadClientes, top } }, patrimonioNeto, memo: { inventarioAPrecioVenta, margenPotencial, trabajosEnCurso, extraviadoACosto, canjeEnCaja (legado), movimientosSinCotizacion }, cotizacion }`.

Tests mínimos: caja USD + caja ARS convertida; caja de medio `canje` (legado, hasta el plan 020) ignorada y en memo; CC con saldos de ambos signos (activo vs pasivo, un cliente nunca está en los dos lados); inventario excluye vendido y extraviado; ítem sin costo cuenta en `sinCosto`, no suma; serializado vs no serializado en «Otros»; compra `pendiente` suma a anticipos y `recibida` no; cotización 0/NaN no revienta (devuelve ARS sin convertir marcado como «sin cotización»); patrimonio neto = activo − pasivo.

## Parte B — Datos y página

- `lib/dolar-server.ts` (`import "server-only"`): `getDolarServer()` con `revalidate: 300` y el mismo fallback que `lib/dolar.ts`.
- `lib/db/patrimonio.ts` (`import "server-only"`): trae en paralelo las listas existentes (`listCajas`, `listMovimientos`, `listMovimientosCC`, `listClientes`, `listCelulares`, `listNotebooks`, `listRepuestos`, `listOtros`, `listCompras`, `listTickets`) y llama a `armarPatrimonio`. **Ojo con el volumen**: `listMovimientos` trae todos los movimientos de caja; para una org grande conviene después una RPC/SQL que devuelva el saldo agregado por caja. Anotarlo como mejora, no bloquear la fase 1.
- `app/(app)/patrimonio/page.tsx` (server, `requireRole("admin")`, `Section title="Patrimonio" ayuda="patrimonio"`), `patrimonio-client.tsx` solo si hace falta interacción (expandir detalle). Sin `actions.ts`: es solo lectura.
- `lib/nav.ts`: ítem `{ href: "/patrimonio", label: "Patrimonio", icon: Landmark, roles: ["admin"] }` + sumarlo a `hrefs` de Finanzas en las categorías del TopNav.
- Centro de ayuda: agregar `patrimonio` a `SECCIONES_AYUDA`/`SECCION_LABEL` y un artículo `content/ayuda/patrimonio/guia.mdx` (qué mide cada línea, qué NO incluye, cómo se convierte ARS, FAQ). Si el plan 017 ya se ejecutó, seguir su formato.

## Parte C — UI (sistema de diseño de CLAUDE.md)

Orden fijo, una columna en mobile, 2 en `xl`:

1. **Cabecera**: cotización usada + «al dd/mm hh:mm» + aviso «Balance gerencial».
2. **Tarjetas** (`StatCard`, 4): **Patrimonio neto** (grande, valor en `font-grotesk`), **Activo total**, **Pasivo total**, **Liquidez** (Disponibilidades ÷ Activo, en %; hint «de cada U$ 100 de activo, U$ x están en caja»). Fase 2 les agrega `delta` vs mes anterior.
3. **Gráficos** (`GraficoCard` `h-72`, paleta índigo): composición del activo (`GraficoDona`: Disponibilidades / Créditos / Inventario / Anticipos, con leyenda y % dentro) y, al lado, el inventario por categoría (`GraficoRanking`: Celulares / Notebooks / Repuestos / Otros).
4. **Detalle en tres cards** (tablas con la cebra global, montos a la derecha, `tabular-nums`, `fmtUsd`/`fmtArs`, nunca formatos a mano):
   - *Disponibilidades*: una fila por caja (nombre, medio, saldo en su moneda, equivalente USD); las ARS marcan la cotización. Link a `/cajas`.
   - *Créditos y saldos a favor*: top 8 deudores y top saldos a favor, links a `/cuentas-corrientes`. Si hay clientes en ambos extremos, dos tablas separadas.
   - *Inventario*: por categoría, unidades, valor a costo, **valor a precio de venta** y margen potencial; badge «N sin costo» si corresponde. Link a `/inventario`.
5. **Pie «Qué no incluye»** (memo): trabajos en curso, extraviado a costo, movimientos sin cotización, lo no modelado (cuentas a pagar, impuestos, sueldos).

Estados vacíos: org nueva en 0 → mostrar el balance en cero con texto guía, no una pantalla rota. Sin dark mode, sin gradientes nuevos, `aria-label` en cualquier control solo-ícono.

**Parte C bis — unificar el valor de inventario**: extraer a `lib/inventario.ts` una función pura `valorInventario({ celulares, notebooks, repuestos, otros })` (excluye `vendido` **y** `extraviado`) y que la usen `components/inventario-valor.tsx` (hoy cuenta extraviados) y `armarPatrimonio`; sin eso Inventario y Patrimonio van a mostrar números distintos para lo mismo. Test incluido. **Depende del plan 018**: si todavía no se hizo, dejar `notebooks` como parámetro opcional.

## Fase 2 — Evolución (opcional, después de la 1)

Tabla `patrimonio_snapshots (id, organization_id default current_user_org_id(), fecha date, cotizacion numeric, activo_usd, pasivo_usd, patrimonio_usd numeric, detalle jsonb, unique (organization_id, fecha))`, migración con las 4 policies (`org_puede_escribir()` en escritura, **select solo admin** con `current_user_rol() = 'admin'`) y grants a `authenticated`/`service_role`; correr `get_advisors` security al aplicarla. Se escribe **perezosamente**: al abrir `/patrimonio` un admin, si no existe el snapshot de hoy se hace upsert (no hace falta cron porque la cotización sale de dolarapi). Con eso: línea «Patrimonio neto — últimos 12 meses» (`GraficoCard`) y `delta` vs mes anterior en las tarjetas. **No hay backfill**: no se puede reconstruir el inventario del pasado, así que la serie arranca el día que se despliega; decirlo en la UI («Historial desde dd/mm»).

## Fuera de alcance

Cuentas a pagar a proveedores (requiere modelar compras a crédito), impuestos/IVA, sueldos, activos fijos y amortización, exportar a PDF/Excel, vista para el contador, patrimonio por sucursal.

## Verificación

- `npx tsc --noEmit` y `npx vitest run` (tests de `lib/patrimonio.test.ts` incluidos).
- Con la org de prueba: el total de **Disponibilidades** coincide con el «Total (ARS)»/saldos de Cajas convertidos; **Créditos** coincide con la suma de deudas en Cuentas corrientes; **Inventario** coincide con «Valor de inventario» de Inventario (mismo número después de la Parte C bis). Cambiar una caja a ARS sin cotización y ver el aviso.
- Rol vendedor/técnico: no aparece en la nav y `/patrimonio` redirige/404.
- Org en «solo lectura»: la página se ve completa (es de lectura).
- Mobile a 360 px: sin scroll horizontal (tablas con `min-w-0`, montos `whitespace-nowrap`).
- Informe final: decisiones que se cambiaron, discrepancias entre secciones, y lo que quedó fuera.

---

## Informe de ejecución

**Implementado (Fase 1)**
- **Lógica pura**: `lib/patrimonio.ts` (`armarPatrimonio`) + `lib/patrimonio.test.ts` (8 tests). Incluye la excepción de la caja de canje (legado) y la cotización inválida.
- **Valor de inventario unificado**: `valorInventario()` en `lib/inventario.ts` (excluye `vendido` **y** `extraviado`, incluye notebooks, calcula `valorVenta`/`margen`/`sinCosto`/`extraviadoACosto`), con tests. Lo usan `armarPatrimonio` y `components/inventario-valor.tsx` (ahora con la categoría Notebooks).
- **Cotización server**: `lib/dolar-server.ts` (`import "server-only"`, `revalidate: 300`, mismo fallback que `lib/dolar.ts`).
- **Datos**: `lib/db/patrimonio.ts` (`getPatrimonio()`), trae las listas en paralelo y llama a la lógica pura.
- **Página**: `app/(app)/patrimonio/page.tsx` (`requireRole("admin")`, solo lectura) + `patrimonio-client.tsx` (client, porque pasa formateadores a los gráficos). Cabecera con cotización usada, 4 `StatCard` (neto/activo/pasivo/liquidez), composición del activo (dona) + inventario por categoría (ranking), detalle de Disponibilidades / Créditos y saldos a favor / Inventario, y pie «Qué no incluye».
- **Nav**: ítem `Patrimonio` (admin, ícono `Landmark`) + sumado a la categoría Finanzas; `lib/nav.test.ts` actualizado (admin Finanzas ahora 4).
- **Ayuda**: `patrimonio` en `SECCIONES_AYUDA`/`SECCION_LABEL` + `content/ayuda/patrimonio/guia.mdx` (formato plan 017: líneas, qué NO incluye, conversión de pesos, FAQ).

**Verificación**
- `npx tsc --noEmit` OK · `npx vitest run` → **415** tests OK (13 nuevos entre inventario y patrimonio).
- `/patrimonio` sin sesión → 307 a `/login` (gating correcto); con admin carga la página.
- **No se probó con la org de prueba** (sin sesión admin en el entorno): pendiente de revisión manual la coincidencia de totales (Disponibilidades vs Cajas, Créditos vs Cuentas corrientes, Inventario vs «Valor de inventario»).

**Decisiones / discrepancias**
- El **selector de inventario a costo** excluye extraviados; el StatCard «Valor a costo» de Analíticas (`stockItems`) sigue incluyendo extraviados (solo excluye vendidos). No se tocó `stockItems` porque excede el plan; Inventario y Patrimonio **sí** coinciden ahora (misma función).
- `lib/dolar.ts` sigue siendo client-only; el server usa `lib/dolar-server.ts` (endpoint/fallback duplicados a propósito).
- ~~La caja de canje se excluye del activo~~ — **desactualizado**: al ejecutarse el plan 020 esa excepción se quitó del código. Mientras la migración de limpieza `20261017140000_canje_sin_caja.sql` no se aplique, la caja legada «CANJE» (U$ 210, org UPDATE TECH) **sí suma** a Disponibilidades.

**Fuera de alcance (queda pendiente)**
- **Fase 2**: tabla `patrimonio_snapshots`, escritura perezosa al abrir la página, línea «Patrimonio neto — últimos 12 meses» y `delta` en las tarjetas.
- Optimización: `listMovimientos()` trae todo el historial de caja; conviene una RPC/SQL de saldo agregado por caja para orgs grandes.
- Cuentas a pagar a proveedores, impuestos, sueldos, activos fijos, export PDF/Excel, patrimonio por sucursal.

## Revisión posterior (2026-10-17)

Se revisó la implementación contra la base real (org UPDATE TECH) y se corrigieron dos errores:
- **Anticipos a proveedores**: contaban toda compra `pendiente`, pero hay compras viejas sin caja ni egreso (ej. C-5, U$ 90) que **no se pagaron desde Tekly**. Ahora solo es anticipo la pendiente con `cajaId`; el resto va al memo «Compras pendientes sin pago registrado». (Con los datos actuales: anticipos U$ 1.800, no U$ 1.890.)
- **Clientes dados de baja**: Créditos/Saldos a favor se calculaban recorriendo `listClientes()` (solo activos), así que la deuda de un cliente dado de baja desaparecía del balance. Ahora se recorre por los clientes con movimientos y el nombre cae a «Cliente dado de baja».
- Aclarado el memo «Movimientos en pesos sin cotización» (no afecta el balance: el saldo de cada caja ARS se convierte a la cotización de hoy).

Valores de referencia para la verificación manual (UPDATE TECH, calculados por SQL): cajas ARS (CAJA ARS 1.108.900 + TARJETA 505.425 + TRANSFERENCIAS 1.303.850 = $ 2.918.175), CAJA USD U$ 250, CANJE U$ 210 (legado); Créditos U$ 200 (1 cliente); Saldos a favor U$ 100 (1 cliente); inventario a costo: celulares U$ 2.800 (8) + repuestos U$ 1.165 + «Otros» (sin calcular); anticipos U$ 1.800. Sigue pendiente la comprobación en pantalla con una sesión admin.

## Fase 2 · implementación (2026-10-17)

- **Base**: `supabase/migrations/20261017150000_patrimonio_snapshots.sql` (aplicada). Tabla `patrimonio_snapshots (organization_id default current_user_org_id(), fecha, cotizacion, activo_usd, pasivo_usd, patrimonio_usd, detalle jsonb, unique (organization_id, fecha))`. RLS: **select, insert, update y delete solo `admin`** de la org, y las escrituras además exigen `org_puede_escribir()`. Sin acceso `anon`. `get_advisors` security: sin hallazgos nuevos.
- **Lógica pura**: `lib/patrimonio-historial.ts` (+ test, 8 casos): `serieMensual` (última foto de cada mes, tope 12, sin inventar meses vacíos), `variacionVsMesAnterior` (contra el **cierre del mes anterior**; `null` si no hay foto de ese mes o la base es ≤ 0), `primeraFoto`, `mesPrevio`.
- **Datos**: `lib/db/patrimonio-snapshots.ts` — `registrarSnapshot` (upsert por `organization_id,fecha`, la última visita del día gana; **nunca rompe la página**: en solo lectura la RLS lo rechaza y se ignora; no guarda sin cotización válida) y `listSnapshots(desde)`.
- **Página**: `app/(app)/patrimonio/page.tsx` registra la foto de hoy (hora de Argentina, `hoyISO()`), lee los últimos 12 meses y pasa `historial`/`variacion`/`desdeFoto` al cliente.
- **UI**: `components/patrimonio/evolucion-chart.tsx` (`GraficoCard`, una línea índigo, un punto por mes, tooltip con neto/activo/pasivo, aviso «Historial desde dd/mm»); `StatCard` de Patrimonio neto y Activo muestran `delta` «vs <mes>». **El pasivo no lleva delta** (`Delta` pinta de verde lo que sube).
- **Ayuda**: sección «Evolución mes a mes» + 2 FAQ en `content/ayuda/patrimonio/guia.mdx`.
- **Límites conocidos**: no hay backfill; sin cron, un mes sin visitas queda sin punto (si hace falta garantizar un cierre mensual, agregar un `pg_cron` que calcule el balance en SQL o un botón «Registrar cierre»); el cálculo sigue trayendo todo `movimientos_caja` (ver nota de escala en la Parte B).
- **Pendiente de verificación manual** (sin sesión admin en el entorno): abrir `/patrimonio` dos veces y comprobar que queda **una** fila en `patrimonio_snapshots` con la última cotización; con un snapshot de mes anterior cargado a mano, ver el delta en las tarjetas.
