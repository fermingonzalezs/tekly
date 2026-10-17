# 018 — «Equipos» pasa a «Celulares» + nueva categoría «Notebooks»

**Status:** EJECUTADO (2026-10-17) — base aplicada + código completo (verificación manual con datos pendiente).
**Scope:** rename `Equipo` → `Celular` en todo el repo (UI, tipos, funciones, rutas, copy, manual de ayuda, tests) + categoría nueva **Notebooks** en Inventario, Ventas (Nueva venta / detalle / comprobante / garantía), Dashboard (rubros), buscador global y demo. **Fuera de alcance** (no tocar, solo que no se rompan): Turnos, Difusión, Analíticas, Recuentos y Importar CSV para notebooks — quedan como seguimiento.

## ⚠️ Estado de la base (ya migrada — NO volver a aplicar)

`supabase/migrations/20261017120000_celulares_y_notebooks.sql` ya está aplicada al proyecto `tekly` (`xdfdrzxrmfpnezyeeaeq`), que es **el mismo** para dev y prod. Mientras no se despliegue el código de este plan, la app desplegada que lea `equipos` **falla**. Por eso el código nuevo tiene que quedar listo y desplegarse junto.

Lo que cambió en la base (los datos existentes ya fueron migrados):

| Antes | Ahora |
|---|---|
| tabla `equipos` | tabla **`celulares`** (mismas columnas, policies `celulares_*`) |
| `venta_items.equipo_id` | **`venta_items.celular_id`** |
| `turnos.equipo_ids` | **`turnos.celular_ids`** |
| `venta_items.categoria` ∈ `equipo\|servicio\|otro\|libre` | ∈ **`celular\|notebook\|servicio\|otro\|libre`** (filas viejas `equipo` → `celular`) |
| `movimientos_stock.item_type` ∈ `equipo\|repuesto\|otro` | ∈ **`celular\|notebook\|repuesto\|otro`** (filas viejas migradas) |
| `recuentos_stock.tipo` ∈ `equipos\|repuestos\|otros` | ∈ **`celulares\|repuestos\|otros`** (filas viejas migradas) |
| — | **`venta_items.notebook_id`** → `notebooks(id)` (nuevo, nullable) |
| — | tabla **`notebooks`** (nueva, ver abajo) |
| `listas_difusion.secciones` entradas `"tipo":"equipo"` | `"tipo":"celular"` (hoy no había filas afectadas) |

Tabla `notebooks`: `id uuid`, `organization_id` (default `current_user_org_id()`), `modelo text not null`, `cpu`, `memoria`, `almacenamiento`, `pantalla`, `color`, `idioma`, `numero_serie`, `garantia` (todos `text` nullable), `notas text`, `costo_usd numeric not null default 0`, `precio_usd numeric not null default 0`, `estado text not null default 'en_revision'` ∈ `en_revision|disponible|reservado|vendido|extraviado` (los mismos que celulares), `activo boolean not null default true` (borrado lógico, igual que `celulares`), `created_at`, `unique (organization_id, numero_serie)`. RLS: 4 policies (select / insert+`org_puede_escribir()` / update+`org_puede_escribir()` / delete solo `admin`), grants a `authenticated` y `service_role`, sin acceso `anon`.

## Decisiones (ya tomadas con el dueño)

1. Rename **completo**: UI, código y base. «Equipos» (categoría de inventario) → «Celulares».
2. Notebook = **unidad única** con número de serie (no stock por cantidad), con Costo y Precio USD y los mismos 5 estados que celulares (En revisión / Disponible / Reservado / Vendido / Extraviado). «Estado» del pedido original = estado de stock.
3. Campos de notebook pedidos: modelo, CPU, memoria, almacenamiento, pantalla, color, idioma, estado, garantía, notas. Agregados por necesidad: número de serie, costo, precio.
4. Integración «completa»: Inventario + vender desde Nueva venta (estado, margen y garantía en el comprobante). Turnos/Difusión/Analíticas/Recuentos quedan para después.

## Parte A — Rename `Equipo` → `Celular`

**Cuidado: «equipo» está sobrecargado.** Renombrar SOLO la entidad de stock (la tabla `celulares`). **NO tocar**:
- `Ticket.equipo`, `Ticket.descripcionEquipo`, `tickets.equipo`, `tickets.descripcion_equipo` (el aparato que entra a reparar), ni el copy «Información del equipo» / «Datos del equipo» de los tickets y recibos.
- `CanjeEquipo`, `canjeEquipo`, `Compra` de canje (`marca`/`imei`/…, «equipo recibido»), `EntregarEquipoDialog` («Entregar equipo» de un ticket), `reparaciones-client` en general, `Pago.canje.equipo`.
- «Invitá a tu equipo» (equipo de trabajo), textos legales, mails.
- Migraciones viejas en `supabase/migrations/` (son historia; no se editan).

Mapa de identificadores (todos los de la entidad de stock):

| Antes | Después |
|---|---|
| tipo `Equipo`, `EquipoStatus`, `equipoStatus` (`lib/status.ts`) | `Celular`, `CelularStatus`, `celularStatus` |
| `EquipoInput`, `EquipoRow`, `EquipoFormDialog`, `toEquipo`, `parseEquipoRow`, `equipoCsvSchema`, `EQUIPO_CSV_HEADERS`, `equipoTemplateCsv`, `EQUIPO_COLS`, `EQUIPO_ESTADOS`, `ESTADOS_EQUIPO`, `CAMPOS_EQUIPO` | mismos con `Celular` / `CELULAR` |
| `listEquipos`, `createEquipo`, `updateEquipo`, `deleteEquipo`, `createEquiposBulk`, `crearRecuentoEquipos`, `restituirEquipos`, `resumenEquipos`, `agingEquipos`, `equiposPorEstado`, `diasInventarioEquipos`, `importEquiposAction`, `*EquipoAction`, `diffEquipo` | `…Celular(es)…` |
| `RecuentoLineaEquipo`, `RecuentoEquipoItem`, `RecuentoEquiposModalDialog` | `…Celular…` |
| `DifusionReglaEquipo` y su `tipo: "equipo"` | `DifusionReglaCelular`, `tipo: "celular"` |
| `VentaItem.equipoId`, `Turno.equipoIds`, `equipoId`/`equipoIds` en general | `celularId`, `celularIds` |
| `VentaItem.categoria: "equipo"`, `Rubro`/`RUBRO_LABEL.equipo` («Equipos»), `Origen "equipo"` en Nueva venta, `itemTipo/ItemType "equipo"`, `Recuento.tipo "equipos"` | `"celular"` («Celulares»), `"celular"`, `"celular"`, `"celulares"` |
| columnas/queries: `.from("equipos")`, `equipo_id`, `equipo_ids`, `equipos(imei)` embebido en `lib/db/ventas.ts` (`VENTA_ITEM_COLS`), `item_type: "equipo"`, `categoria.eq.equipo`, `equipo_id.not.is.null` | `.from("celulares")`, `celular_id`, `celular_ids`, `celulares(imei)`, `"celular"`, … |
| URL: `/inventario?tab=equipos`, `ventas?tipo=equipo`, `recuentos` tipo | `?tab=celulares`, `?tipo=celular` (en `lib/ventas-filtros.ts` **aceptar también el valor viejo** `equipo` y mapearlo a `celular`, por links/favoritos guardados) |

Los strings de Supabase **no los chequea TypeScript**: buscar a mano `grep -rn "equipos\|equipo_id\|equipo_ids\|'equipo'\|\"equipo\"" lib/db app` y revisar cada match uno por uno. Es el riesgo principal del rename.

Copy visible: pestaña «Equipos» → «Celulares»; títulos, tarjetas, botones («Agregar equipo» → «Agregar celular»), filtros, Dashboard (donut de rubros), Analíticas (labels), recibos/garantías cuando se refieran al ítem de stock, buscador global, mensajes de error, `lib/onboarding.ts` («los equipos y clientes» → «los celulares y clientes»), `lib/marketing/*` y `components/marketing/*` (mockups/módulos/hero que digan «Equipos» como categoría), `lib/mock-data.ts`, `lib/demo/seed.ts`.

Manual de ayuda: actualizar `content/ayuda/**` (Inventario, Ventas, Recuentos, Configuración→Importar datos, Glosario, FAQ, Primeros pasos→inventario-inicial) con «Celulares» y la nueva sección Notebooks; frontmatter `actualizado: <hoy>`.

## Parte B — Notebooks

**Tipo** (`lib/types.ts`):
```ts
export type Notebook = {
  id: string; modelo: string; cpu: string; memoria: string; almacenamiento: string;
  pantalla: string; color: string; idioma: string; numeroSerie: string;
  garantia: string; notas: string; costoUsd: number; precioUsd: number;
  estado: CelularStatus;
};
```
(en la base los textos opcionales son `null`; mapear a `""` en `lib/db/notebooks.ts`, igual que `celulares`). `ItemType` / `MovimientoItem.itemTipo` suma `"notebook"`. `VentaItem` suma `notebookId?: string` y `categoria` suma `"notebook"`.

**Capa de datos**: `lib/db/notebooks.ts` (`import "server-only"`; `listNotebooks`, `createNotebook`, `updateNotebook`, `deleteNotebook` = borrado lógico `activo=false`; cada alta/edición deja un `movimientos_stock` con `item_type: "notebook"` como hace `celulares`). Pedir `numero_serie` único por org: validar duplicado antes de insertar y devolver error legible. Zod en el boundary. Seguir el patrón exacto de `lib/db/inventario.ts` (celulares).

**Inventario** (`app/(app)/inventario/`): nueva pestaña **Notebooks** al lado de Celulares (orden: Celulares / Notebooks / Repuestos / Otros). `page.tsx` trae `listNotebooks()`. Tabla con columnas: Modelo (+serie debajo), CPU, Memoria, Almacenamiento, Pantalla, Estado (chip con punto, `celularStatus`), Costo (solo `puedeVerCosto`), Precio. Fila clickeable → `NotebookFormDialog` (ver/editar; el mismo con `notebook={null}` es el alta, título «Nueva notebook»/«Editar notebook»), campos en grilla `sm:grid-cols-2` con `Field`: Modelo*, CPU, Memoria, Almacenamiento, Pantalla, Color, Idioma, N.º de serie, Estado (Select, nunca `Tabs`), Garantía, Costo USD, Precio USD, Notas (`Textarea`, `sm:col-span-2`). Botón «Agregar notebook» en la fila de filtros (`BarraFiltros.accion`, `ml-auto`). Buscador por modelo/serie/CPU y filtro por estado. Usar `SeccionTabla` (gráficos: estado y valor de stock; tarjetas: total, disponibles, reservadas, valor a costo/venta — reusar `components/seccion/graficos.tsx` y `StatCard`; en tablas respetar las reglas globales: montos a la derecha, `tabular-nums`). Los gráficos/tarjetas de la pestaña Celulares siguen mostrando solo celulares. `actions.ts`: `createNotebookAction`/`updateNotebookAction`/`deleteNotebookAction` con `requireRoleEscritura` (alta/edición admin y vendedor como celulares; borrar solo admin — verificar cómo está hoy en celulares y copiarlo).

**Ventas** (`ventas-client.tsx`, `lib/db/ventas.ts`, `lib/ventas.ts`, `lib/demo/*`): `ItemBuscador` ofrece notebooks `disponible` (origen `"notebook"`, badge propio, no repetir una ya agregada) además de celulares; al agregar, `precioUsd`/`costoUsd` salen de la notebook y el detalle = modelo + serie. `createVenta` guarda `notebook_id` y marca la notebook `vendido`; `deleteVenta` con el checkbox «devolver los equipos vendidos a disponible» devuelve **celulares y notebooks** (rótulo: «Devolver celulares/notebooks vendidos a disponible»). `categoriaDe` / `RUBRO_LABEL` / `RUBRO_ORDEN`: nuevo rubro `notebook` = «Notebooks» (5 rubros; `CHART_COLORS` ya tiene 5 pasos). `margenVenta`/Analíticas no cambian. Filtro por rubro (`tipo=`) acepta `notebook`; la búsqueda `q` matchea también el `numero_serie`. «Ítems vendidos»: columna Serie muestra `celulares.imei` o `notebooks.numero_serie` (embed de ambas tablas en `VENTA_ITEM_COLS`). Una venta con ítem notebook cuenta como `tipo: "venta"` igual que celulares.
Comprobante y Garantía (`ventas-client.tsx` → `garantiaContenido(items)`): para notebooks la columna Serie = N.º de serie y Garantía = `notebook.garantia` si está cargada (texto libre, p. ej. «6 meses»), si no el texto general de garantía del negocio. Si hace falta, `VentaItem` suma `garantiaTexto?: string` poblado al crear la venta (snapshot, no recalcular después).

**Dashboard / Analíticas / otros**: el donut de rubros (`ventasPorRubro`) y el mix por rubro muestran «Notebooks» solo desde `categoria`. Buscador global (`lib/db/busqueda.ts`, `components/command-palette`): sumar notebooks (tipo `"notebook"`, subtítulo serie · estado, `href: /inventario?tab=notebooks&q=…`). Demo (`lib/demo/seed.ts`, `operaciones.ts`, `ventas-query.ts` y sus tests): `DemoState` suma `notebooks: Notebook[]` con 3–4 notebooks de ejemplo, determinista; `crearVentaDemo`/`eliminarVentaDemo` las manejan igual que celulares; el aislamiento de `lib/demo/aislamiento.guard.test.ts` se mantiene (sin imports de `lib/db`).

**No se hace ahora (dejar anotado en el informe)**: Turnos con notebooks vinculadas; reglas de Difusión por notebooks; pestaña de notebooks en Analíticas → Inventario; Recuentos de notebooks; Importar CSV de notebooks; Costos/margen de notebooks en Analíticas por modelo.

## Orden de ejecución sugerido

1. Leer `CLAUDE.md` (secciones Inventario, Ventas, RLS, Sistema de diseño, Dialog, Tablas) y esta nota completa. **No** correr `next build` con el dev server levantado.
2. Parte A, en este orden: `lib/types.ts` + `lib/status.ts` → `lib/db/*` y `lib/*.ts` → `app/(app)/**` → `components/**` → `lib/demo/**` → tests → copy de marketing → `content/ayuda`. Después de cada bloque, `npx tsc --noEmit`. Al terminar A: `npx vitest run` verde y app andando con los datos migrados (el stock de celulares existente tiene que verse igual que antes).
3. Parte B, empezando por tipos y `lib/db/notebooks.ts`, después Inventario, después Ventas, después demo/buscador/rubros. Agregar tests puros: `categoriaDe` con notebook, `RUBRO_LABEL`, parser de `ventas-filtros` (acepta `equipo` legacy → `celular`, acepta `notebook`), `lib/demo/operaciones` (vender y eliminar una venta con notebook).
4. Actualizar `CLAUDE.md`: modelo de datos (tabla `celulares`, `notebooks`, `venta_items.celular_id/notebook_id`), nota de Inventario, «Estado de la migración», paleta/rubros. Agregar la fila al `plans/README.md`.

## Verificación

- `npx tsc --noEmit` y `npx vitest run` limpios.
- `grep -rniE "\bequipos?\b" app lib components` y revisar que solo queden los usos legítimos de la lista «NO tocar» (tickets, canje, entregar equipo, equipo de trabajo, textos legales).
- Con sesión real de la org de prueba: ver Inventario → Celulares (los 16 existentes siguen ahí con sus movimientos), alta/edición de un celular, **alta de una notebook con todos los campos**, editarla, cambiarle el estado, intentar repetir el número de serie (debe fallar con mensaje claro), vender una notebook en Nueva venta (queda `vendido`, aparece en Ítems vendidos con su serie), imprimir comprobante y garantía, eliminar la venta devolviendo la notebook a `disponible`, buscarla en el buscador global, ver «Notebooks» en el donut del Dashboard.
- Como vendedor: no ve costo ni margen de notebooks; no puede borrar. Org en «solo lectura»: no puede crear/editar (RLS `org_puede_escribir()`).
- `get_advisors` tipo `security`: sin hallazgos nuevos.
- Demo `/demo/dashboard` y `/demo/ventas` andan; `lib/demo/aislamiento.guard.test.ts` pasa.
- Informe final: archivos tocados, matches sospechosos de `equipo` que se dejaron a propósito, y lo que quedó fuera de alcance.
