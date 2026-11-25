# 025 — Compras / Ingresos: toda entrada de stock pasa por una compra (estilo sistema-update)

**Status:** Fase 1 HECHA en código (migración `20261125100000_compras_ingresos.sql` aplicada). Fases 2–4 pendientes.
**Diferencias con el diseño original (fase 1):** `compra_items` guarda solo los ítems de compras que suben al stock (el jsonb `compras.items` sigue siendo el snapshot, sin backfill); `compra_items.usuario_nombre` para el historial; «Reponer» abre Nueva compra sin preelegir el repuesto; el «+ Agregar unidad» dentro de la edición de un producto serializado de Otros sigue existiendo (ajuste, no compra).
**Scope:** la sección Compras pasa a ser **«Compras / Ingresos»**: ahí se carga una compra y se elige si **sube al stock** (crea las unidades en el inventario) o **no** (gasto o historial). Carga de ítems individual (formulario con variante + «Leer con IA») y por lote (IA sobre fotos/PDF/texto + QR desde el celular, con revisión por fila). Historial de ingresos. Inventario queda para **ver, editar y hacer recuentos** — sin altas.
**Fuera de alcance:** sucursales (tekly no tiene); contabilidad; pagos parciales o a cuenta de proveedor (cuenta corriente de proveedores); «Importar datos» de Configuración (queda como **carga inicial**, ver Decisión 6).

## Referencia

`../sistema-update` (solo lectura, no tocar):

- `src/modules/compras/components/NuevaCompraModal.jsx` — compra con carrito: datos generales (proveedor, fecha, medio, **costos adicionales prorrateados**), ítems individuales (`CargaEquiposUnificada modoCompra` → `onReturnData`) o por lote (`IngresoLoteIA modo="compra"`), «Finalizar» crea recibo + `compra_items` + unidades + `ingresos_equipos`. Mensaje de error con progreso si falla a mitad (sin transacción).
- `src/modules/administracion/components/IngresoEquiposSection.jsx` — historial `ingresos_equipos` (fecha, serial, color, producto, categoría, precio compra, proveedor, usuario; buscar por modelo/serial/proveedor).
- IA individual: `LeerConIAModal.jsx` (3 pasos: qué equipo → cómo cargar → revisar), `LeerConIA.jsx` (copy de venta, imagen subida/arrastrada/pegada con Ctrl+V, **QR** con resultado por Realtime), `CapturaEquipo.jsx` (página pública `/captura/<id>`, compresión a 1600 px JPEG 0.85), edge function `supabase/functions/leer-etiqueta-equipo` (id de un solo uso, 15 min, toma atómica `pendiente → procesando`), campos por tipo en `supabase/functions/_shared/camposEquipo.ts`.
- IA por lote: `IngresoLoteIA.jsx` + `IngresoLoteTabla`/`IngresoLotePanel`, `hooks/useLecturaLoteIA.js` (3 archivos en paralelo, imagen/PDF), `CapturaLote.jsx` (QR de lote: 2 h, hasta 60 archivos), edge function `leer-equipos-lote` (**recibe la lista de variantes `SKU: descripción` y la IA elige el SKU; si duda devuelve ""**; tope 50 ítems, PDF ≤ 20 MB, imagen ≤ 5 MB), lógica pura `utils/loteIA.js` (`itemsAFilas`, `aplicarVariante`, `validarFila`, `marcarDuplicados`, `erroresLote`, `datosVarianteDesdeLeido` para «Crear variante» desde una fila).

Se copia **comportamiento, no estilo**: todo con el sistema de diseño de tekly (`CLAUDE.md`). En tekly la IA corre en **server actions** (Anthropic SDK, como `lib/ia/importacion.ts`), no en edge functions.

## Cómo es hoy (tekly)

- `compras` (`lib/db/compras.ts`, `app/(app)/compras/`): `items` es `jsonb` de `{ detalle, cantidad, costoUsd }` **en texto libre**, sin vínculo con el stock. `createCompra` solo genera el egreso de caja. `marcarRecibida` solo cambia `estado`. `origen: "canje"` es la única compra que crea stock (lo hace `createVenta`).
- Altas de stock hoy, **todas fuera de Compras**: «Agregar celular»/«Agregar notebook» (`CelularFormDialog`/`NotebookFormDialog` en `inventario-client.tsx`), «Agregar / ingresar repuesto» y «… producto» (`crearRepuesto`/`ingresoRepuesto`, `crearOtro`/`ingresoOtroExistente`), Importar datos (Configuración) y canje.
- Historial: `movimientos_stock` (`item_type`, `item_id`, `detalle`, usuario) — solo se ve por ítem, dentro del detalle.
- Variantes: celulares (plan 024) y notebooks (migración `20261124230000_variantes_notebooks.sql`, en curso). Repuestos y Otros sin variantes.
- IA: `leerConIaAction` (Configuración → Importar datos) — solo texto, Haiku, cupo de 1 lectura por tipo (`lib/ia-lecturas.ts`, tabla `ia_lecturas`).

## Decisiones (tomadas con el usuario — no re-decidir)

1. **Toda entrada de stock pasa por una compra.** Inventario pierde los botones de alta e ingreso; queda ver/editar/recuento/baja. Si no hubo pago (equipo propio, encontrado en un recuento), se carga una compra **sin caja y sin proveedor**.
2. **Cada compra elige si sube al stock** (`compras.sube_stock`). Sube → los ítems son **tipados** (celular, notebook, repuesto, otro) y crean las unidades. No sube → ítems en texto libre como hoy (insumos, herramientas, gastos).
3. **El stock entra al guardar.** Una compra que sube al stock nace `recibida` (como sistema-update). El estado `pendiente` queda solo para compras que **no** suben al stock.
4. **IA completa en la primera versión**: texto, fotos y PDF desde la PC (subir, arrastrar, Ctrl+V) **y QR para cargar desde el celular**, individual y por lote.
5. **La IA elige la variante**: el prompt recibe las variantes activas de la org (`SKU: descripción`) y devuelve un SKU existente o `""`. El server valida que el SKU exista; nunca se confía en lo que devuelve.
6. **«Importar datos» (Configuración) queda como carga inicial** del stock existente, sin compra. El texto de esa pantalla lo aclara y linkea a Compras / Ingresos para lo diario.

## Diseño

### Datos (migración `2026112xxxxxxx_compras_ingresos.sql`)

- `compras.sube_stock boolean not null default false` (las viejas quedan `false`), `compras.costos_adicionales_usd numeric not null default 0`, `compras.notas text`.
- **`compra_items`** (tabla nueva, como `venta_items` — se saca del jsonb para poder listar ingresos y linkear unidades): `compra_id → compras.id on delete cascade`, `tipo` (`celular|notebook|repuesto|otro|libre`), `detalle`, `cantidad`, `costo_usd` (unitario, sin prorrateo), `costo_adicional_usd` (prorrateo), `variante_id` nullable, `celular_id`/`notebook_id`/`repuesto_id`/`otro_id` nullables (FK `on delete set null`), `serie` (IMEI o número de serie, para el historial). RLS: 4 policies + `org_puede_escribir()` + `DEFAULT current_user_org_id()` + `grant` (ver «RLS — reglas de oro»). Sin rol admin para borrar (igual que `compras`, por la compensación de errores).
- Backfill: una fila `libre` por cada ítem del jsonb `compras.items` existente. El jsonb queda de lectura hasta borrarlo en una migración posterior.
- `celulares.compra_id` y `notebooks.compra_id` (FK `on delete set null`) — de qué compra vino cada unidad (el canje también lo llena).
- `movimientos_stock.compra_id` nullable — para repuestos/otros, donde la unidad no es única.
- **`capturas_ia`** (QR): `id uuid`, `organization_id`, `tipo` (`celular|notebook|repuesto|otro`), `modo` (`individual|lote`), `estado` (`pendiente|procesando|listo|error`), `resultado jsonb`, `error`, `archivos int`, `created_at`. Escribe **solo service role**; la PC la lee por RLS de su org.

### Lógica pura (`lib/compras.ts` + test)

- `prorratearCostos(items, adicional)` — proporción al costo, redondeo a centavos, el resto del redondeo al ítem más caro (la suma da exacto).
- `validarItemCompra` / `erroresCompra` — variante obligatoria en celular/notebook, IMEI/serie únicos dentro de la compra, cantidad ≥ 1, costo ≥ 0.
- `itemsLeidosAFilas`, `aplicarVariante` (precio y color de la variante sin pisar lo editado por el usuario — port de `loteIA.js`), `marcarDuplicados(filas, existentes)`.
- `resumenCompra` (subtotal, adicional, total) — lo usa el dialog y el server.

### Server

- `lib/db/compras.ts` → `createCompra` con `subeStock`: inserta `compras` + `compra_items`; si sube al stock, crea las unidades con las funciones que ya existen (`createCelularesBulk`/`createNotebooksBulk` con `compraId`, `crearRepuesto`/`ingresoRepuesto`, `crearOtro`/`ingresoOtroExistente`) **copiando los datos de la variante** (mismo criterio que el plan 024), costo = costo unitario + prorrateo, y escribe los ids en `compra_items`. Egreso de caja como hoy. Si algo falla a mitad: compensa borrando lo creado (mismo patrón que `createVenta`/`deleteVenta`).
- `deleteCompra` con opciones como «Eliminar venta»: borrar el egreso de caja y **sacar del stock las unidades** — solo las que siguen `en_revision`/`disponible` (celular/notebook) o restando la cantidad (repuesto/otro, sin bajar de 0); las vendidas se conservan y se avisa con un banner.
- `listIngresosPagina` — una fila por `compra_items` con `sube_stock`: fecha, compra (`C-12`), tipo, producto, serie, costo final, proveedor, usuario. Filtros en la URL como Ventas (`q`, `tipo`, `preset`/`desde`/`hasta`, `page`).
- IA (`lib/ia/ingreso.ts`, server-only): `leerEquipo({ tipo, texto | imagen })` y `leerLote({ tipo, archivo, variantes })` con salida estructurada (campos por tipo, reutilizando las columnas de `lib/importacion.ts`). Modelo: el mismo que `lib/ia/importacion.ts`. Límites: imagen ≤ 5 MB (el cliente comprime a 1600 px), PDF ≤ 20 MB, texto ≤ 20.000, 50 ítems.
- Cupo (`lib/ia-lecturas.ts`): la regla actual (1 por tipo) es de la carga inicial. Para el ingreso diario: **cupo mensual por plan** (`PLANES`), `ia_lecturas_ilimitadas` lo saca. Cada archivo leído cuenta una lectura. → **definir números con el usuario antes de implementar.**
- QR: ruta pública `app/captura/[id]/page.tsx` (sin sesión, `ALWAYS_PUBLIC_PATHS`, `noindex`) + `POST /api/captura/[id]` (route handler): valida uuid, toma la captura de forma atómica (`pendiente → procesando`, vencimiento 15 min individual / 2 h lote, máx. 60 archivos), lee con IA y guarda en `capturas_ia.resultado` (**service role con `organization_id` de la captura**, nunca del request). Rate limit por captura. La PC escucha con **Realtime `postgres_changes`** sobre su fila — `lib/auth/supabase.ts` es la única puerta, así que se agrega un helper allí; o, más simple y sin depender de Realtime, **polling cada 2 s** mientras el QR está abierto (recomendado: no suma canales públicos, ver «Pendiente: canales privados»).

### UI

- Nav: `Compras` → **«Compras / Ingresos»** (mismo `/compras`). Pestañas en `BarraFiltros`: **Compras** (la tabla de hoy, con columna «Stock» sí/no) · **Ingresos** (historial de unidades ingresadas). Acción primaria: **«Nueva compra»**.
- `NuevaCompraDialog` (`size="4xl"`, `formulario`, 2 columnas en `lg`):
  - **Datos**: proveedor (texto libre como hoy, `resolveProveedorId`), fecha, medio + caja (opcionales: sin caja = sin egreso), costos adicionales, notas, y el switch **«Subir al stock»**.
  - **Ítems** (si sube al stock): botones «Celular» · «Notebook» · «Repuesto» · «Otro» abren el formulario del tipo **en modo compra** (los `CelularFormDialog`/`NotebookFormDialog` existentes con `onReturnData`, sin guardar) + «Leer con IA» dentro de cada uno; **«Cargar lote con IA»** abre el lote. Lista del carrito agrupada por lote, con costo prorrateado en vivo, quitar ítem/lote.
  - **Ítems** (si no sube): las filas de texto libre de hoy.
  - Footer: total + «Guardar compra» (`loading`); el error muestra cuántas unidades se crearon si la compensación falló.
- `LeerConIaDialog` (individual): pasos «Cómo cargar → Revisar». Pegar texto, subir/arrastrar/Ctrl+V imagen, o QR. «Revisar» muestra lo leído y «Usar estos datos» completa el formulario (la variante se sugiere con `buscarVariante`).
- `IngresoLoteDialog` (`4xl`): tipo, zona de archivos + QR, estado por archivo, tabla editable (reutilizar `TablaEditable` de Importar datos) con columna «Variante» (selector + «Crear variante con estos datos»), contadores «Sin variante» / «Con errores», tope 50. «Agregar a la compra» devuelve las filas al carrito.
- Inventario: se quitan «Agregar celular/notebook», «Agregar / ingresar repuesto/producto» y sus dialogs de alta; en su lugar un `ButtonLink` tonal **«Nueva compra»** → `/compras?accion=nueva-compra`. El detalle de una unidad muestra «Ingresó con la compra C-12» (link `/compras?open=`). El catálogo de variantes (vista Agrupada) conserva «Agregar unidad», que abre Nueva compra con la variante elegida (`?accion=nueva-compra&variante=<id>`).
- Detalle de compra: ítems con link a cada unidad; recibo de compra (opcional, `ReciboImprimir` con sello nuevo en `SELLOS`).

### Realtime / eventos

- `low_stock` no cambia (sale de ventas/bajas). Nada nuevo que publicar.

## Fases

1. **Datos + núcleo**: migración, `lib/compras.ts` (+ test), `createCompra`/`deleteCompra` con stock, `NuevaCompraDialog` con ítems manuales (celular/notebook con variante, repuesto, otro), prorrateo, pestaña Ingresos. Inventario sin altas. Canje llena `compra_id`.
2. **IA desde la PC**: `lib/ia/ingreso.ts`, `LeerConIaDialog` (texto/imagen), `IngresoLoteDialog` (imágenes/PDF, variantes en el prompt, crear variante desde fila), cupo mensual.
3. **QR**: `capturas_ia`, `/captura/[id]`, route handler, polling/Realtime en la PC, individual y lote.
4. **Docs**: `CLAUDE.md` (Compras, Inventario, nuevo apartado de IA/QR), ayuda (`content/ayuda/compras/*`, `inventario/*` — los artículos de alta pasan a Compras), `/qa` si hay componentes nuevos.

Cada fase: `npx tsc --noEmit`, `npx vitest run`, `get_advisors` security después de cada migración, verificación en el navegador con sesión admin.

## Abiertas (preguntar antes de la fase correspondiente)

- Números del cupo mensual de IA por plan (fase 2).
- ¿Recibo/PDF de compra? (fase 1, opcional).
- Rol: hoy Compras es `admin`/`tecnico`. Si toda alta de stock pasa por acá, ¿el vendedor también carga compras sin ver costos? (fase 1).
