# 021 — Modales de formulario: todo centrado menos las casillas, 3 casillas por fila

**Status:** HECHO en código — falta verificación visual (`/qa/dialog` + cada modal con sesión admin a 1280/768/360 px)
**Scope:** `components/ui/dialog.tsx` (+ helper compartido), y los dialogs de **formulario** de cajas, clientes, configuración, compras, cuentas-corrientes, difusión, recuentos, reparaciones, turnos, ventas, `servicios-catalogo`, `reportar-bug-fab`. Sin cambios de datos, actions ni lógica de negocio. **No toca el ancho (`size`) de ningún dialog.**
**Reemplaza** a `plan-modales-centrados.md` (raíz del repo): ese plan es anterior a 011 (pedía header índigo + footer de pills a mano, ya no vigente). Borrarlo al terminar.

## Referencia ya hecha (Inventario)

Los modales de **ingreso** de Inventario ya siguen estas reglas y son la
referencia visual: `CelularFormDialog` y `NotebookFormDialog` (solo en modo
alta, `!edit`) e `IngresoDialog`, en `app/(app)/inventario/inventario-client.tsx`.
Mirar cómo quedaron antes de empezar. Hoy usan una constante local `CENTRADO`
en ese archivo; este plan la mueve a un lugar compartido.

## Reglas (decididas con el dueño, no reabrir)

1. **Todo centrado** dentro del cuerpo del dialog: labels de `Field`, eyebrows/títulos de sección, textos de ayuda, avisos, resúmenes, checkboxes (casilla + texto como bloque centrado).
2. **Excepción única: el contenido de las casillas** — lo que se escribe/elige dentro de `Input`, `Select` y `Textarea` va a la izquierda (`text-start`, y `text-align-last: start` en `select`). Incluye textareas de notas/descripción.
3. **3 casillas por fila** desde `sm` (`grid grid-cols-1 gap-3.5 sm:grid-cols-3`); 1 columna en mobile. Un campo largo (nombre, dirección, textarea, buscador) ocupa la fila entera con `sm:col-span-3`; un par que necesita más aire puede usar `sm:col-span-2` + uno de 1. No dejar filas huérfanas si se puede reordenar sin cambiar el orden lógico de la carga.
4. **Ancho: no se toca.** Si con 3 columnas un dialog `md`/`lg` queda apretado (campos de ~120 px), recién ahí subirlo un escalón y anotarlo en el reporte final — es la excepción, no la regla.
5. **Sin cambios de lógica**: ni validaciones, ni orden de tabulación importante, ni textos de botones.

## Qué NO entra

- Dialogs de **solo vista/detalle** (`VentaDetalle`, detalle de ticket, detalle de compra, ficha de cliente, etc.): ya tienen su patrón (`grid-cols-3`, `Card p-3 text-center`). No tocar.
- `ConfirmDialog` y `ConfirmarAltaDialog` (resúmenes/avisos, sin casillas): ya se leen bien; **no** aplicar `CENTRADO`.
- Los modales de **recuento** (`RecuentoModalDialog`, `RecuentoCelularesModalDialog`, `RevisarRecuentoDialog`): son tablas/listas de revisión, no formularios de campos. Dejarlos como están.
- `AuthModal`, `CommandPalette`, `bienvenida`, `MobileNavDrawer`: no son `Dialog`.
- En modo **edición** de Inventario (celular/notebook/repuesto/otro ya cargado) se mantiene como está hoy (sin centrar) — contiene el historial de movimientos.

## Paso 1 — Mecanismo compartido (hacer primero)

En `components/ui/dialog.tsx` agregar una prop opcional **`formulario?: boolean`** (default `false`). Cuando es `true`, el contenedor del `children` (el body) recibe las clases:

```
text-center
[&_input]:text-start [&_textarea]:text-start
[&_select]:text-start [&_select]:[text-align-last:start]
```

(son exactamente las de `CENTRADO` de Inventario). Alternativa aceptable si tocar el body del `Dialog` es incómodo: exportar la constante `CAMPOS_CENTRADOS` desde `components/ui/field.tsx` y envolver el body a mano — pero **preferir la prop**, así cada dialog nuevo hereda la regla con una palabra.

Además exportar de `components/ui/field.tsx` un helper `GrillaCampos` (`<div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">`, acepta `className`) para no repetir el string de 3 columnas en ~40 sitios. Los hijos que ocupan más usan `className="sm:col-span-2"` / `sm:col-span-3`.

Luego en `inventario-client.tsx`: borrar la constante local `CENTRADO` y las 3 condiciones `cn(..., CENTRADO)` y usar la prop `formulario` del `Dialog` (`formulario={!edit}` en celular/notebook, `formulario` fijo en `IngresoDialog`). Los grids de Inventario pasan a `GrillaCampos`. Resultado visual idéntico al actual.

**Ojo con el body de un `Dialog` anidado:** `ConfirmDialog` / `ConfirmarAltaDialog` envuelven `Dialog` pero no usan `formulario`, así que el centrado del padre no se hereda (se montan como hermanos vía portal). Verificarlo.

## Paso 2 — Aplicar a cada dialog de formulario

Para cada uno: pasar `formulario` al `<Dialog>`, reemplazar sus grillas de 1–2 columnas por `GrillaCampos` (3 col), poner `col-span` a los campos largos, y revisar que los bloques propios (cards, checkboxes, avisos) se vean bien centrados. Lista (función → archivo):

| Archivo | Dialogs de formulario |
|---|---|
| `app/(app)/cajas/cajas-client.tsx` | `NuevoMovimientoDialog`, `CajaDialog`, `ConciliarDialog` (este último es por-caja: centrar las filas, 3 casillas = monto contado + comentario; si no cierra bien en 3, dejar la fila propia) |
| `app/(app)/clientes/clientes-client.tsx` | `ClienteFormDialog` (alta/edición) |
| `app/(app)/configuracion/configuracion-client.tsx` | `InvitarUsuarioDialog`, `EditarMiembroDialog` / `CambiarRolDialog` |
| `app/(app)/compras/compras-client.tsx` | `NuevaCompraDialog` |
| `app/(app)/cuentas-corrientes/cuentas-corrientes-client.tsx` | `NuevoMovimientoCCDialog` |
| `app/(app)/difusion/difusion-client.tsx` | `ListaEditorDialog` |
| `app/(app)/reparaciones/reparaciones-client.tsx` | `NuevoTicketDialog`, `EntregarEquipoDialog`, `AgregarItemDialog` |
| `app/(app)/turnos/turnos-client.tsx` | `AgendarDialog` |
| `app/(app)/ventas/ventas-client.tsx` | `NuevaVentaDialog` (referencia compleja: ver abajo), `CanjeModal` |
| `app/(app)/inventario/inventario-client.tsx` | `RepuestoFormDialog` y `OtroFormDialog` **en modo alta** (si se abren con `item=null`; en edición no). Ya hechos: celular, notebook, `IngresoDialog` |
| `components/servicios-catalogo.tsx` | `ServicioDialog` |
| `components/reportar-bug-fab.tsx` | el dialog de reporte (textarea grande: fila entera) |

Casos especiales:

- **`NuevaVentaDialog`** (el más complejo): tiene tarjetas de pago (una fila entera por pago, ver CLAUDE.md "Convenciones" #4), buscador de ítems (`ItemBuscador`) y tabla de ítems. Aplicar `formulario` al dialog, pasar a 3 columnas **solo** los bloques de campos sueltos (cliente/vendedor/fecha/etc.); las tarjetas de pago conservan su fila. La tabla de ítems no cambia (la regla global de tablas manda). Verificar que las celdas de la tabla no hereden `text-start` raro de los inputs.
- **Checklists** (`ChecklistEditor`, Reparaciones/Canje): su grilla propia es de 3 ya; solo asegurar que el centrado no desalinee los botones bien/mal/n-a.
- **Dropdowns absolutos** (`ClientePicker`, `ItemBuscador`): las opciones de la lista desplegable heredan `text-center`; dejarlas a la izquierda con `text-start` en su contenedor (son contenido de casilla).
- **Selects de moneda/medio** en pagos: siguen siendo casillas → `text-start`.

## Paso 3 — Documentación

- `CLAUDE.md`, sección «`Dialog`: footer con el sistema único de botones» (o la de `Dialog` en la tabla de primitivos): documentar la prop `formulario`, la regla «todo centrado menos el contenido de las casillas», `GrillaCampos` y «3 casillas por fila desde `sm`». Actualizar el «Body: …pares cortos → `grid-cols-2`» que hoy dice 2 columnas.
- `app/qa/dialog/demo.tsx`: agregar un caso con `formulario` y `GrillaCampos` para QA visual.
- Borrar `plan-modales-centrados.md` (raíz) y agregar la fila 021 en `plans/README.md`.

## Verificación

1. `npx tsc --noEmit` y `npx vitest run` (447 tests hoy, todos deben seguir pasando; `lib/botones.guard.test.ts` falla si se escribe un botón a mano).
2. Visual (obligatorio, no alcanza con tipos): `/qa/dialog` y abrir **cada** dialog de la tabla con sesión admin, a **1280 px**, **768 px** y **360 px**. Chequear: labels centrados, texto dentro de las casillas a la izquierda, 3 columnas desde `sm`, 1 en mobile, sin desbordes horizontales, sin filas huérfanas feas, dropdowns de `ClientePicker`/`ItemBuscador` alineados a la izquierda.
3. Confirmar que **no** cambiaron: detalles de solo vista, `ConfirmDialog`, recuentos, tablas (headers/celdas siguen la regla global).
4. Correr `graphify update .` al final (regla del repo).

## Riesgos

- `text-center` hereda a todo el body, incluidos spans/links/botones inline que hoy van a la izquierda: revisar cada dialog, no asumir.
- Un `Dialog` de ancho `md` con 3 columnas queda angosto (~110 px por casilla en 448 px): por eso la regla 4. Preferir `col-span` y reordenar antes que ensanchar.
- No usar `text-center` en inputs numéricos de tablas dentro de un dialog (p. ej. cantidades en la tabla de ítems): son casillas → `text-start`, o mantener su alineación actual si la tabla ya define otra; no mezclar.
