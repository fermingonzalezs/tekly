# 024 — Celulares: grupo › variante › unidad (estilo sistema-update)

**Status:** PENDIENTE — plan listo para que lo ejecute otro agente.
**Scope:** solo **Celulares** de Inventario. Una tabla nueva `variantes`, columnas nuevas en `celulares` (`variante_id`, `precio_propio`), lógica pura `lib/variantes.ts` (+ test), `lib/db/variantes.ts`, la vista agrupada de Inventario → Celulares, el selector de variante en todas las altas de celulares (alta manual, edición, importación CSV/IA y canje en Nueva venta), herramientas de variante (renombrar grupo, editar, desactivar/eliminar, unir), stock mínimo con aviso, ayuda y `CLAUDE.md`.
**Fuera de alcance:** Notebooks, Otros y Repuestos (quedan como están); vender «por variante» (Nueva venta sigue eligiendo la unidad); fotos; catálogo web.

## Referencia

`../sistema-update` (otro proyecto, misma carpeta `proyectos/`, React + Vite, **solo lectura: no tocar nada ahí**).

- `docs/plan-capa-variantes.md` (fase 1: tabla `variantes`, clave normalizada, backfill, precio = moda) y `docs/plan-ingreso-con-variantes.md` (fase 2: elegir grupo → variante al cargar, campos copiados y bloqueados, grupo como nombre propio, desactivar/eliminar). **Leer los dos antes de empezar.** Este plan toma la fase 2 como modelo final, adaptada a tekly.
- `src/modules/stock/utils/adaptadores.js` (+ `.test.js`): `agruparPorGrupo`, `claveGrupo`, `camposDesdeVariante`, `filaParaVariante`, `ordenarGrupos`.
- `src/modules/stock/components/`: `VariantesTable.jsx` (grupos plegables › variantes › unidades, rango de precio), `SelectorVariante.jsx` (combobox de 2 pasos), `VarianteFormModal.jsx`, `VarianteModal.jsx`, `RenombrarGrupoModal.jsx`, `UnirVariantesModal.jsx`, `VistaVariantesCatalogo.jsx` («Ver desactivadas (N)»).

Se copia **comportamiento y estructura, no estilo**: todo con el sistema de diseño de tekly (`CLAUDE.md`: `Button`/`IconButton`, `Dialog` vidrio + `formulario`, `GrillaCampos`, `SeccionTabla`/`BarraFiltros`, `MenuAcciones`, chips de estado con `dotClass`, tablas globales, `fmtUsd`). Sin sucursales (tekly no tiene) ni slate/emerald. Sin triggers de Postgres para la lógica de negocio: en tekly vive en TypeScript (`lib/variantes.ts` puro + `lib/db/`), la base solo garantiza integridad (FK, unique, RLS).

## Cómo es hoy (tekly)

- `celulares` (`lib/db/inventario.ts`): una fila por unidad con `modelo`, `almacenamiento`, `color`, `imei`, `bateria`, `condicion` (`CONDICIONES_CELULAR` de `lib/status.ts`: `NUEVO, A+, A, B+, B, C`), `costo_usd`, `precio_usd`, `estado` (`en_revision|disponible|reservado|vendido|extraviado`), `activo` (baja lógica). Tipo `Celular` en `lib/types.ts`.
- **Quién crea celulares** (las 3 vías deben exigir variante):
  1. Alta/edición manual: `CelularFormDialog` (`app/(app)/inventario/inventario-client.tsx`, ~l. 2466) → `createCelularAction`/`updateCelularAction` (`app/(app)/inventario/actions.ts`) → `createCelular`/`updateCelular`.
  2. Importación CSV / «Leer con IA»: `app/(app)/configuracion/importar-datos.tsx` (`ImportCard` + `TablaEditable`, columnas en `COLUMNAS_CELULAR` de `lib/importacion.ts`) → `importCelularesAction` (`app/(app)/configuracion/actions.ts`) → `createCelularesBulk`.
  3. Canje en Nueva venta: `CanjeModal` (`app/(app)/ventas/ventas-client.tsx`, ~l. 2647) → `createVenta` (`lib/db/ventas.ts`, ~l. 764) → `createCelular` (estado `en_revision`, costo = valor del canje, precio 0).
- Consumidores que leen `modelo/almacenamiento/condicion/color/precio_usd` de `celulares` y **no deben cambiar**: Nueva venta (`ItemBuscador`), Difusión (`lib/difusion.ts`), Analíticas, búsqueda global (`lib/db/busqueda.ts`), recibos/garantías, Recuentos, Agenda (turnos de compra). Por eso la variante **copia** sus datos a la unidad (ver Decisiones 4 y 5) en vez de que la unidad los lea de la variante.
- Datos reales: **19 celulares, 1 organización** (24/11/2026). El backfill es chico.
- `lib/realtime.ts` ya define `low_stock` (`{ actor, part, qty }`) y **nada lo dispara**. Este plan lo conecta.

## Decisiones (tomadas con el usuario — no re-decidir)

1. **Solo Celulares.**
2. **La variante se elige al cargar** el equipo: grupo → variante, o crear una. **SKU automático** (sugerido por el sistema, editable, obligatorio y único por organización).
3. **Grupo = nombre libre**, columna propia de la variante, precargado con el modelo. Renombrarlo no toca el modelo de la variante ni de los equipos. Agrupar por el grupo normalizado (minúsculas, `trim`, espacios colapsados).
4. **Clave de la variante** = `modelo + almacenamiento + condición + color`, donde **color es opcional en la variante**:
   - Variante con color (ej. «iPhone 15 · 128 GB · A · Negro»): el color es parte de la variante y se copia bloqueado al equipo.
   - Variante sin color («cualquier color»): cada equipo carga su propio color.
   - Un equipo **busca primero la variante con su color** y, si no hay, la de «cualquier color» (`buscarVariante`).
   - Pueden convivir «iPhone 15 · 128 GB · A» (cualquier color) y «… · Negro» (claves distintas).
5. **Datos clave copiados y bloqueados**: al elegir variante, `modelo`, `almacenamiento`, `condicion` (y `color` si la variante lo tiene) se copian a la fila de `celulares` y en el formulario quedan en solo lectura con el texto «Definido por la variante <SKU>». IMEI, batería, costo, estado y (si la variante no tiene) color siguen siendo de la unidad.
6. **Precio en la variante, con excepción por unidad**: `variantes.precio_usd` es el precio base. `celulares.precio_usd` **sigue siendo el precio efectivo** (lo que leen Ventas/Difusión, sin tocarlos). Columna nueva `celulares.precio_propio boolean default false`: si es `false`, el precio de la unidad = el de la variante y se actualiza cuando cambia el de la variante (solo unidades no vendidas). Si es `true`, la unidad conserva su precio. El costo sigue siendo por unidad.
7. **Importación (CSV / IA): variante por fila** en la tabla de revisión. Cada fila llega con la variante **sugerida** si los datos coinciden (`buscarVariante`). Un selector permite cambiarla o «+ Crear variante con estos datos». **Una fila sin variante no se importa** (error de fila).
8. **Canje: selector de variante en `CanjeModal`**, el mismo componente que el alta de Inventario.
9. **Vista**: Inventario → Celulares abre **agrupada** (grupos plegables › variantes › unidades) con un toggle **«Agrupado / Unidades»** que vuelve a la tabla plana de hoy.
10. **Herramientas que entran**: renombrar grupo; editar variante; desactivar / eliminar variante sin stock («Ver desactivadas (N)» para reactivarlas); unir variantes; stock mínimo por variante con aviso.

### Defaults que decidí yo (cambiarlos solo si el usuario lo pide)

- **Roles**: crear/editar variante y renombrar grupo → cualquier rol con escritura (`requireEscritura`, un vendedor también carga celulares). Unir, desactivar y eliminar → **admin** (`requireRoleEscritura("admin")`), como el resto de los borrados de la app.
- **Stock de una variante** = unidades `activo = true` con `estado = 'disponible'`. Se muestran aparte las `reservado`/`en_revision`. Los `vendido`/`extraviado` no cuentan.
- **Stock mínimo**: `variantes.stock_minimo integer not null default 0`; `0` = sin aviso.
- **Eliminar** solo si **ninguna** fila de `celulares` (de cualquier estado, activa o no) la referencia; si no, se ofrece desactivar. FK `on delete restrict`.
- **Editar los datos clave de una variante** (modelo/almacenamiento/condición/color) se propaga a sus unidades **no vendidas**. Si la nueva clave ya existe en otra variante → error «Ya existe <SKU> con esos datos: usá Unir».
- **Crear una variante cuya clave existe pero está desactivada** → se reactiva esa (no se duplica).
- **Elegir una variante desactivada** no es posible desde el selector (no lista desactivadas), pero asignarle una unidad por otra vía la reactiva.

## Modelo de datos

Migración `supabase/migrations/<timestamp>_variantes_celulares.sql`, aplicada con `apply_migration` del MCP `plugin:supabase:supabase` (proyecto `xdfdrzxrmfpnezyeeaeq`). Reglas de `CLAUDE.md` → «RLS — reglas de oro»: `DEFAULT current_user_org_id()`, 4 policies `to authenticated` con `organization_id = current_user_org_id()`, `org_puede_escribir()` en insert/update/delete, `delete` con `current_user_rol() = 'admin'`, `grant` explícito, `revoke all ... from anon`. Copiar la forma exacta de `notebooks` en `supabase/migrations/20261017120000_celulares_y_notebooks.sql`.

```sql
create table public.variantes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_user_org_id()
    references public.organizations (id) on delete cascade,
  categoria text not null default 'celular' check (categoria in ('celular')), -- se amplía cuando entren notebooks
  grupo text not null check (trim(grupo) <> ''),
  sku text not null check (trim(sku) <> ''),
  modelo text not null check (trim(modelo) <> ''),
  almacenamiento text not null default '',
  condicion text not null,
  color text not null default '',            -- '' = cualquier color
  clave text not null,                       -- la calcula lib/variantes.ts (claveVariante)
  precio_usd numeric not null default 0 check (precio_usd >= 0),
  stock_minimo integer not null default 0 check (stock_minimo >= 0),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku),
  unique (organization_id, categoria, clave)
);
-- índices: (organization_id, grupo)
-- RLS + 4 policies + grants como notebooks

alter table public.celulares
  add column variante_id uuid references public.variantes (id) on delete restrict,
  add column precio_propio boolean not null default false;
create index celulares_variante_id_idx on public.celulares (variante_id);
```

Después del backfill (Paso 2): `alter table public.celulares alter column variante_id set not null;` — así ninguna vía futura puede crear un celular sin variante.

## Pasos

### Paso 1 — Lógica pura `lib/variantes.ts` (+ `lib/variantes.test.ts`)

Sin Supabase. Tipos nuevos en `lib/types.ts`: `Variante = { id, grupo, sku, modelo, almacenamiento, condicion, color, precioUsd, stockMinimo, activa }`; `Celular` suma `varianteId: string` y `precioPropio: boolean` (arreglar lo que no compile: seed de la demo, tests, mapeos).

- `normalizar(s)`: minúsculas, `trim`, espacios colapsados, sin tildes.
- `claveVariante({ modelo, almacenamiento, condicion, color })` → `norm(modelo)|norm(almacenamiento)|upper(condicion)|norm(color)`. Almacenamiento normalizado también sin espacios («128 GB» = «128GB»).
- `buscarVariante(variantes, datos)`: solo activas; primero clave con el color del equipo, después con color `''`. `undefined` si no hay.
- `skuSugerido(datos, skusExistentes)`: `IPHONE-15-PRO-128GB-A` (+ `-NEGRO` si tiene color); mayúsculas, sin tildes, no alfanumérico → `-`, sin guiones repetidos; si choca, `-2`, `-3`…
- `camposDesdeVariante(v)` → `{ modelo, almacenamiento, condicion, color? }` (color solo si la variante lo tiene).
- `nombreVariante(v)` → «iPhone 15 Pro · 128 GB · A · Negro» (sin color: «· Cualquier color» solo donde haga falta aclararlo).
- `agruparPorGrupo(variantes)` y `ordenarGrupos(...)`: grupo normalizado; dos variantes con el mismo grupo y distinto modelo quedan juntas.
- `stockDeVariante(v, unidades)` → `{ disponibles, reservadas, enRevision }`.
- `rangoPrecio(v, unidades)` → `[min, max]` de los precios efectivos de las unidades no vendidas (o el de la variante si no hay).
- `precioModa(precios)`: el más frecuente, empate → el mayor (backfill).
- `variantesBajoMinimo(variantes, unidades)`: activas con `stockMinimo > 0` y `disponibles < stockMinimo`.

Tests: cada función, incluyendo la preferencia de color en `buscarVariante`, el desempate de `precioModa`, colisiones de `skuSugerido` y normalización («  iphone 15  » = «iPhone 15»).

### Paso 2 — Migración + backfill

1. Aplicar el esquema de «Modelo de datos».
2. Backfill **en TypeScript no hace falta**: con 19 filas, hacerlo en la misma migración con SQL que reproduzca `claveVariante` (`lower`, `trim`, `regexp_replace('\s+',' ')`, `upper` para condición, `translate` para tildes). Las variantes del backfill se crean **sin color** («cualquier color»), una por `(organization_id, modelo, almacenamiento, condicion)` normalizados, incluyendo unidades vendidas/inactivas:
   - `grupo` = `trim(modelo)` del primer equipo; `sku` = slug (mismo formato que `skuSugerido`, desambiguado con `-2`…); `precio_usd` = moda de `precio_usd` de sus unidades (empate → mayor).
   - `celulares.variante_id` = su variante; `precio_propio` = `precio_usd <> variantes.precio_usd`.
   - Normalizar en la unidad los campos clave a los de la variante **solo** si difieren en mayúsculas/espacios (no cambiar datos reales).
3. `set not null` en `celulares.variante_id`.
4. Verificar con `execute_sql` (anotar resultados en el reporte):
   - V1 `celulares where variante_id is null` = 0.
   - V2 la clave recalculada desde cada celular coincide con la de su variante = 0 diferencias.
   - V3 variantes sin unidades = 0; SKU duplicados por org = 0.
   - V4 `has_table_privilege('anon','public.variantes','select')` = false.
   - V5 RLS: en un bloque `do $$ ... raise exception 'RLS_OK' $$` con `set local role authenticated` + `request.jwt.claims` de un usuario de otra org, no ve variantes ajenas.
   - V6 `get_advisors` security: nada nuevo salvo los 2 WARN esperados y leaked password (ver `CLAUDE.md`).

### Paso 3 — `lib/db/variantes.ts` y cambios en `lib/db/inventario.ts`

`lib/db/variantes.ts` (`import "server-only"`, mapeo snake → camel):

- `listVariantes({ incluirInactivas })`.
- `createVariante(input)`: calcula `clave` con `claveVariante`; si existe una **desactivada** con esa clave → la reactiva y la devuelve; si existe activa → error «Ya existe la variante <SKU> con esos datos»; SKU repetido → «El SKU <SKU> ya existe». SKU en mayúsculas y sin espacios.
- `updateVariante(id, input)`: recalcula clave (conflicto → error que sugiere Unir); si cambian datos clave, los copia a las unidades no vendidas; si cambia el precio, actualiza `precio_usd` de las unidades con `precio_propio = false` y no vendidas. Registrar `addMovimiento("celular", id, "Variante <SKU>: …", "edicion")` por unidad tocada.
- `renombrarGrupo(grupoActual, nuevo)`: actualiza `grupo` de todas las variantes de ese grupo normalizado.
- `setVarianteActiva(id, activa)`, `deleteVariante(id)` (error claro si tiene unidades).
- `unirVariantes(origenId, destinoId)`: mueve todas las unidades de origen a destino, les copia los campos de destino (respetando `precio_propio`), deja un movimiento por unidad y **elimina** la variante origen. Mismo catálogo; si el destino tiene color y alguna unidad de origen tiene otro color → avisar en el diálogo antes de confirmar (se les pisa el color).

`lib/db/inventario.ts`:

- `CelularInput` suma `varianteId: string` y `precioPropio: boolean`. `createCelular`, `updateCelular` y `createCelularesBulk` leen la variante (misma org, activa o la reactivan), **sobrescriben** los campos clave con `camposDesdeVariante` y, si `precioPropio` es `false`, `precio_usd` = el de la variante. Nunca confiar en los campos clave que mande el cliente.
- `CELULAR_COLS` y `toCelular` suman `variante_id`, `precio_propio`.

Actions nuevas en `app/(app)/inventario/actions.ts`: `createVarianteAction`, `updateVarianteAction`, `renombrarGrupoAction` (`requireEscritura`); `setVarianteActivaAction`, `deleteVarianteAction`, `unirVariantesAction` (`requireRoleEscritura("admin")`). Todas con `revalidatePath("/inventario")`.

### Paso 4 — Componentes compartidos (`components/inventario/`)

- **`variante-dialog.tsx`** (`Dialog` con `formulario`, `GrillaCampos`): Grupo (input con `datalist` de grupos existentes), Modelo, Almacenamiento, Condición (`Select` de `CONDICIONES_CELULAR`), Color (opcional, ayuda «Vacío = cualquier color»), **SKU** (precargado con `skuSugerido`, se recalcula mientras el usuario no lo toque), Precio USD, Stock mínimo. Alta y edición (título `id ? "Editar variante" : "Nueva variante"`). Acepta `inicial` (grupo/modelo precargados desde el selector o desde una fila de importación).
- **`selector-variante.tsx`** (combobox propio, patrón de `ClientePicker` + `useOutsideClick`, navegable con flechas/Enter/Esc):
  1. Paso **Grupo**: búsqueda; cada opción «iPhone 15 Pro (3 variantes)»; «+ Nuevo grupo» pide solo el nombre (no guarda nada hasta crear la primera variante).
  2. Paso **Variante** del grupo: SKU + `nombreVariante` + stock disponible; «+ Nueva variante» abre `VarianteDialog` con el grupo fijo. Grupo nuevo → directo a «Nueva variante».
  3. Con variante elegida: resumen (SKU + datos) y botón «Cambiar».
  - Props: `{ variantes, value: varianteId | null, onChange(variante | null), sugerida?, disabled? }`. No lista desactivadas.

### Paso 5 — Alta y edición manual (`CelularFormDialog`)

- `SelectorVariante` arriba de todo, **obligatorio** (no se puede guardar sin variante: error en el dialog).
- Al elegir variante: completar y **bloquear** Modelo/Almacenamiento/Condición (y Color si la variante lo tiene) con la leyenda «Definido por la variante <SKU>».
- Precio: muestra el de la variante; checkbox **«Precio propio para este equipo»** habilita el campo (`precioPropio`). Destildarlo vuelve al precio de la variante.
- Edición: muestra la variante actual; cambiarla reasigna el equipo (los campos clave se copian de la nueva).
- `InventarioClient` recibe `variantes` desde `app/(app)/inventario/page.tsx` (`listVariantes({ incluirInactivas: true })`).

### Paso 6 — Vista agrupada de Inventario → Celulares

- En `BarraFiltros` del tab Celulares, un control de vista **«Agrupado / Unidades»** (pill `Tabs`, persistido en `localStorage` `tekly:ui:inventario-celulares-vista`, con `try/catch`). «Unidades» = la tabla actual sin cambios. Default: Agrupado.
- Tabla agrupada (componente nuevo `components/inventario/variantes-tabla.tsx`, reglas globales de tablas):
  - **Fila de grupo** (plegable, ▸/▾): nombre, cantidad de variantes, stock disponible total, rango de precio; acción «Renombrar grupo» (`IconButton` lápiz, `aria-label`).
  - **Fila de variante**: SKU (`font-mono`), almacenamiento, condición, color («Cualquiera» si vacío), stock (`disponibles` + chips chicos de reservadas/en revisión), chip **«Stock bajo»** (punto ámbar/rojo, patrón chip de `CLAUDE.md`) si `variantesBajoMinimo`, precio (`fmtUsd`, o rango si hay unidades con precio propio), menú ⋯ (`MenuAcciones`): Editar, Agregar unidad (abre `CelularFormDialog` con la variante preelegida), Unir con…, Desactivar / Eliminar (admin; Eliminar solo sin unidades, con `ConfirmDialog`).
  - **Unidades** (al expandir la variante): IMEI, color, batería, estado (chip + `dotClass` de `celularStatus`), costo (solo `puedeVerCosto`), precio (marca «propio» si `precioPropio`), botón 📋 (`CopiarTexto`) como hoy. Click → `CelularFormDialog`.
  - Los filtros existentes (búsqueda, estado) filtran **unidades**; se ocultan variantes y grupos sin unidades que coincidan (salvo sin filtros activos: se ven todas las activas, también con stock 0).
  - Interruptor **«Ver desactivadas (N)»**: lista solo las desactivadas, en gris, con «Reactivar».
- Gráficos y tarjetas de la sección no cambian (siguen sobre unidades).
- `UnirVariantesDialog`: elegir destino (mismo grupo primero) + resumen de cuántas unidades se mueven y qué campos cambian; `danger` para confirmar.

### Paso 7 — Importación (CSV / Leer con IA)

- `app/(app)/configuracion/page.tsx` pasa `variantes` (activas) a `ImportarDatos` → `ImportCard` de celulares.
- `COLUMNAS_CELULAR` (`lib/importacion.ts`) suma una columna virtual **`variante`** (no está en la plantilla CSV ni en el prompt de la IA), que va **segunda**, justo después de Estado (`ordenColumnas`).
- Al armar la tabla (`completarFila` o un paso nuevo específico de celulares): `varianteId` sugerido con `buscarVariante` sobre los datos de la fila.
- Celda Variante: `SelectorVariante` compacto con `sugerida`, más **«+ Crear variante con estos datos»** (abre `VarianteDialog` con modelo/almacenamiento/condición/color de la fila; al crearla, asignarla a **todas** las filas con la misma clave que no tengan variante).
- Fila con variante: Modelo/Almacenamiento/Condición (y Color si la variante lo tiene) se reemplazan por los de la variante y esas celdas quedan deshabilitadas. Fila sin variante → error «Elegí la variante».
- `parseCelularRow` exige `varianteId`; `importCelularesAction` revalida en el server que cada `varianteId` sea de la org y copia los campos (mismo camino que `createCelularesBulk` del Paso 3). La lectura con IA no cambia (la IA no elige variantes).

### Paso 8 — Canje (`CanjeModal` en `ventas-client.tsx`)

- `SelectorVariante` en el bloque del equipo recibido, obligatorio, con los campos clave bloqueados igual que en el Paso 5.
- `CanjeModal` necesita `variantes`: pasarlas desde `app/(app)/ventas/page.tsx`.
- El pago canje lleva `varianteId`; `createVenta` (`lib/db/ventas.ts`) se lo pasa a `createCelular` (precio 0 → `precioPropio: true`, para no heredar el de la variante en un equipo `en_revision`). La `Compra` de canje guarda el modelo que sale de la variante.

### Paso 9 — Stock mínimo y aviso

- Badge «Stock bajo» en la vista agrupada (Paso 6) y un `StatCard` más es **opcional**: no cambiar la cantidad de tarjetas de la sección.
- Disparar `low_stock` (`lib/realtime.ts`, `{ actor, part, qty }` con `part` = `nombreVariante`) **desde el client component**, después de que la action confirmó, cuando una variante **cruza** el mínimo hacia abajo:
  - en Nueva venta (`createVentaAction` devuelve las variantes que quedaron bajo mínimo por esa venta);
  - en Inventario al cambiar el estado de una unidad o dar de baja.
  - La lógica de «cruzó» (antes ≥ mínimo, después < mínimo) va en `lib/variantes.ts` con test. Nunca desde `lib/db` ni `actions.ts` (regla de `CLAUDE.md`).
- Actualizar la nota de `CLAUDE.md` que dice que `low_stock` no lo dispara nadie.

### Paso 10 — Ayuda y `CLAUDE.md`

- Artículo nuevo `content/ayuda/inventario/variantes.mdx` (grupo/variante/unidad, color opcional, precio propio, stock mínimo, unir/desactivar) y actualizar `importar-csv.mdx` (columna Variante) y el artículo de canje si existe. Capturas solo con datos demo.
- `CLAUDE.md`: sección Inventario (vista agrupada, `variantes`, `lib/variantes.ts`, selector obligatorio en las 3 altas), «Modelo de datos» (tabla nueva), Importar datos (columna variante), Notificaciones (`low_stock` ahora se dispara).
- Sumar la fila 024 a `plans/README.md` con el status final.

## Verificación

- `npx tsc --noEmit` y `npx vitest run` en verde (tests nuevos de `lib/variantes.ts` y los ajustados de `lib/importacion.test.ts`).
- V1–V6 del Paso 2 con su resultado real.
- `graphify update .` (si el comando no existe, decirlo).
- **No** hace falta probar en el navegador (el login tiene CAPTCHA): dejar una lista corta para que el usuario pruebe: alta con variante existente / nueva / grupo nuevo; color fijo vs cualquiera; precio propio; editar precio de variante y ver unidades; vista agrupada + toggle; renombrar grupo; unir; desactivar/eliminar; importar con IA (sugerida, crear desde fila, fila sin variante); canje; stock mínimo → toast en otra pestaña.
- **No commitear.**

## Reporte final

1. Migración aplicada (nombre) y tabla V1–V6.
2. Variantes creadas por el backfill (SKU → cantidad de unidades, precio) y unidades que quedaron con `precio_propio`.
3. Archivos tocados por paso.
4. Desvíos del plan y por qué.
5. tsc / vitest.
6. Lista de prueba manual.
