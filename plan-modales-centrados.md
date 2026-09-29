# Plan: unificar todos los modales al estilo de "Nueva venta"

Este documento es el plan de implementación completo para otro agente.
Es descartable: borralo del repo cuando termines la feature (no es
documentación permanente, es un plan de handoff). El estilo de referencia
es **exactamente** `NuevaVentaDialog` en `app/(app)/ventas/ventas-client.tsx`
(línea ~1671) — cuando algo no esté claro, mirá cómo lo resuelve ese dialog.

## Decisiones ya tomadas (no las reabras)

Todas confirmadas con el usuario, con la opción recomendada en cada caso:

1. **Alcance: absolutamente todos los dialogs de la app** — los ~35
   `<Dialog>` (alta/edición, detalle/vista, alertas) más los 11 usos de
   `<ConfirmDialog>`. Ver "Inventario completo de dialogs" abajo para la
   lista con archivo:línea de cada uno.
2. **Header/footer: una sola familia** — todo pasa a header índigo
   (`accent`) + footer de pills a mano (el que ya usa Nueva venta). Se
   eliminan las excepciones de header blanco + `Button`.
3. **Qué se centra dentro de una Card**: el `Eyebrow` de cada sección, el
   `label` de cada `Field` y el contenido de `Select`/inputs de valor corto
   (números, fechas, selects). **Los inputs de texto libre (nombre, email,
   dirección, textarea de notas/aclaraciones/descripción) quedan alineados
   a la izquierda** — centrar un párrafo o una dirección se lee mal. Esto es
   una excepción puntual a la regla global de CLAUDE.md "Fuera de tablas,
   alinear a la izquierda con `text-start`" — ver Paso 5 (actualizar
   CLAUDE.md) para dejarlo documentado como tal, no como una contradicción
   suelta.
4. **Checkboxes**: casilla + su texto quedan centrados como un bloque
   (el conjunto se centra horizontalmente dentro de su Card/fila, no pegado
   a la izquierda como hoy).
5. **`Eyebrow` se extrae a `components/ui/eyebrow.tsx`** — hoy es una
   función privada solo en `ventas-client.tsx` (línea 1303); se va a usar en
   ~25 archivos más, así que se comparte en vez de copiarse.
6. **`components/ui/confirm-dialog.tsx` se rediseña** (header accent +
   patrón de checkbox-en-bloque como prop estructurada) para que los 11 usos
   existentes lo hereden solos, en vez de tocar cada uno a mano.
7. **Dialogs de solo-vista (detalle)**: NO se reconstruyen desde cero — ya
   siguen el patrón documentado en CLAUDE.md (`grid grid-cols-3 gap-3`,
   `<Card className="p-3 text-center">` por celda). Auditar cada uno contra
   ese patrón y corregir **solo** los que se desviaron.

## Paso 0 — Piezas compartidas nuevas (hacer esto primero, todo lo demás depende de acá)

### `components/ui/eyebrow.tsx` (nuevo)

Extraer tal cual de `ventas-client.tsx:1303-1310`:

```tsx
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 border-b border-neutral-200 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
      {children}
    </p>
  );
}
```

Borrar la función local de `ventas-client.tsx` y reemplazar por
`import { Eyebrow } from "@/components/ui/eyebrow";`.

### `components/ui/confirm-dialog.tsx` (rediseño)

Dos cambios:

1. **Header accent**: agregar `accent` al `<Dialog>` interno. El botón de
   confirmar sigue en rojo (`bg-red-600`, es una acción destructiva —
   semántico, no de marca, no lo toques) y el de cancelar sigue como pill
   neutro — ninguno de los dos cambia de color, solo el header pasa a
   índigo.
2. **Prop nueva `checks?`** para el patrón de checkbox-en-bloque, en vez de
   que cada call site arme su propio `<label>`:

```tsx
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Eliminar",
  pending,
  checks,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  checks?: {
    id: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
  }[];
}) {
  return (
    <Dialog open={open} onClose={onClose} accent title={title} footer={/* sin cambios */}>
      <div className="space-y-3 text-sm text-neutral-500">
        {children}
        {checks?.map((c) => (
          <label
            key={c.id}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-neutral-200 p-3 text-center text-[13px] font-medium text-neutral-700"
          >
            <input
              type="checkbox"
              checked={c.checked}
              onChange={(e) => c.onChange(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
            />
            {c.label}
          </label>
        ))}
      </div>
    </Dialog>
  );
}
```

Migrar los **2 usos que hoy arman checkboxes a mano** (los otros 9 usos de
`ConfirmDialog` no tienen checkboxes propios — heredan el header accent
solo con este cambio, sin tocarlos):

- `app/(app)/ventas/ventas-client.tsx:853-926` — "Eliminar venta", 5
  checkboxes condicionales (`restituirEquipos`, `restituirRepuestos`,
  `eliminarMovimientosCaja`, `eliminarMovimientoCC`, `eliminarCompraCanje`).
  Pasar cada uno como un item de `checks` (mismas condiciones `open.items.some(...)`
  etc. para incluir o no cada entrada en el array).
- `app/(app)/compras/compras-client.tsx:359+` — 1 checkbox, mismo criterio.

## Paso 1 — Migrar los 4 dialogs de header blanco a accent + pills

Estos son los únicos que hoy **no** tienen `accent` en su `<Dialog>` (el
resto ya es accent, aunque CLAUDE.md todavía documenta `NuevoClienteDialog`
y `NuevoTicketDialog` como header blanco — esa parte de CLAUDE.md ya está
desactualizada, corregilo en el Paso 5):

| Archivo:línea | Dialog | Footer hoy | Footer nuevo |
|---|---|---|---|
| `components/servicios-catalogo.tsx:155` | `ServicioDialog` (Nuevo/Editar servicio) | `<Button variant="outline">`/`<Button>` | pills a mano (Cancelar neutro + Guardar accent) |
| `components/reportar-bug-fab.tsx:44` | "Reportar un problema" | `<Button>` | pills a mano |
| `app/(app)/reparaciones/reparaciones-client.tsx:1253` | "Checklist de egreso" | `<Button>` | pills a mano |
| `app/(app)/reparaciones/reparaciones-client.tsx:1391` | "Agregar a Servicios asociados" (`AgregarItemDialog`) | revisar footer actual | pills a mano |

Para cada uno: agregar `accent` al `<Dialog>`, reemplazar el footer de
`<Button>` por los dos `<button>` pill a mano (mismas clases que Nueva
venta, ver CLAUDE.md "`Dialog`: todos los de una sección son una sola
familia visual" para el texto exacto de las clases).

## Paso 2 — Inventario completo de dialogs y qué hacer con cada uno

Clasificación: **FORM** (alta/edición → aplicar Card+Eyebrow+centrado
completo), **DETALLE** (solo vista → auditar contra el patrón ya
documentado, tocar solo si se desvía), **ALERTA** (mensaje corto de 1-2
líneas, sin secciones → no necesita Eyebrow/Card, solo confirmar que el
texto quede centrado si corresponde).

### Ventas (`app/(app)/ventas/ventas-client.tsx`)

| Línea | Título | Tipo | Acción |
|---|---|---|---|
| 792 | `Venta {id}` | DETALLE | Auditar `VentaDetalle` contra el patrón grid-cols-3 |
| 1671 | Nueva venta | — | **Referencia, no tocar** |
| 2049 | "El monto no coincide" | ALERTA | Verificar texto centrado, sin Eyebrow |
| 2109 | "Equipo recibido en canje" (`CanjeModal`) | FORM | Aplicar Card+Eyebrow por sección (equipo, checklist, aclaraciones) |

### Cajas (`app/(app)/cajas/cajas-client.tsx`)

| Línea | Título | Tipo | Acción |
|---|---|---|---|
| 623 | detalle de movimiento | DETALLE | Auditar |
| 811 | "Nuevo movimiento" | FORM | Card+Eyebrow |
| 926 | "Nueva caja"/"Editar caja" (`CajaDialog`) | FORM | Card+Eyebrow (probablemente 1 sola Card, es un form chico — ver nota abajo) |
| 1041 | "Conciliar cajas" (`ConciliarDialog`, `size="2xl"`) | FORM | Una Card por caja activa (ya es plural por naturaleza) |

### Clientes (`app/(app)/clientes/clientes-client.tsx`)

| Línea | Título | Tipo | Acción |
|---|---|---|---|
| 204 | ficha de cliente | DETALLE | Auditar |
| 518 | "Nuevo/Editar cliente" (`NuevoClienteDialog`) | FORM | Card+Eyebrow. Ya tiene `accent` — no hace falta el Paso 1 acá |

### Compras (`app/(app)/compras/compras-client.tsx`)

| Línea | Título | Tipo | Acción |
|---|---|---|---|
| 305 | detalle de compra | DETALLE | Auditar (incluye bloque de canje, ver CLAUDE.md "Compras") |
| 622 | "Nueva compra" | FORM | Card+Eyebrow |

### Difusión (`app/(app)/difusion/difusion-client.tsx`)

| Línea | Título | Tipo | Acción |
|---|---|---|---|
| 266 | vista de lista (`viewing`) | DETALLE | Auditar |
| 379 | "Nueva/Editar lista" | FORM | Card+Eyebrow (revisar si el editor de `secciones` anidadas entra bien en Cards o si conviene 1 Card por sección de difusión) |

### Configuración (`app/(app)/configuracion/configuracion-client.tsx`)

| Línea | Título | Tipo | Acción |
|---|---|---|---|
| 232 | "Invitar usuario" | FORM | Probablemente 1 solo campo (email) — ver nota "modales chicos" abajo |
| 339 | "Editar usuario" (`CambiarRolDialog`) | FORM | Form chico, mismo criterio |

### Recuentos (`app/(app)/recuentos/recuentos-client.tsx`)

| Línea | Título | Tipo | Acción |
|---|---|---|---|
| 471 | "Recuento"/"Revisar recuento" | FORM (mayormente tabla) | Es una tabla de recuento, no un form de Fields — el Eyebrow/Card no aplica igual acá. Revisar si tiene algún bloque de texto/inputs fuera de la tabla (ej. comentario general) y centrar labels ahí; **no** forzar Card alrededor de la tabla completa |

### Turnos (`app/(app)/turnos/turnos-client.tsx`)

| Línea | Título | Tipo | Acción |
|---|---|---|---|
| 451 | detalle de turno (`sel`) | DETALLE | Auditar |
| 883 | "Agendar turno" | FORM | Card+Eyebrow (cliente / fecha-hora-tipo / equipos vinculados si aplica) |

### Cuentas corrientes (`app/(app)/cuentas-corrientes/cuentas-corrientes-client.tsx`)

| Línea | Título | Tipo | Acción |
|---|---|---|---|
| 268 | ficha de cliente CC | DETALLE | Auditar |
| 487 | "Nuevo movimiento" | FORM | Card+Eyebrow |

### Inventario (`app/(app)/inventario/inventario-client.tsx`)

| Línea | Título | Tipo | Acción |
|---|---|---|---|
| 1652 | Recuento (repuestos/otros) | FORM (tabla) | Mismo criterio que Recuentos arriba — no forzar Card sobre la tabla |
| 1796 | "Recuento de equipos" | FORM (tabla) | Ídem |
| 1939 | `EquipoFormDialog` (ver+editar) | FORM | Card+Eyebrow por bloque (Identificación, Estado, Precio, etc. — ver campos actuales del form) |
| 2144 | Repuesto (ver+editar) | FORM | Card+Eyebrow |
| 2375 | Producto/`OtroItem` (ver+editar) | FORM | Card+Eyebrow |
| 2759 | "Agregar/ingresar X" (Ingreso) | FORM | Card+Eyebrow |

### Reparaciones (`app/(app)/reparaciones/reparaciones-client.tsx`)

| Línea | Título | Tipo | Acción |
|---|---|---|---|
| 683 | detalle de ticket | DETALLE | Auditar (3 documentos + checklist, ver CLAUDE.md "Reparaciones" — es el dialog más complejo de la app, ir con cuidado) |
| 1253 | "Checklist de egreso" | FORM | Paso 1 (blanco→accent) + Card+Eyebrow si tiene más de un bloque |
| 1391 | "Agregar a Servicios asociados" (`AgregarItemDialog`) | FORM | Paso 1 + Card+Eyebrow (catálogo/repuesto/libre son 3 orígenes — evaluar si cada uno es su propia Card o un selector arriba) |
| 1550 | "Nuevo ticket de reparación" | FORM | Card+Eyebrow. Ya tiene `accent` |
| 1811 | "Entregar equipo" | FORM | Card+Eyebrow |
| 1985 | "El monto no coincide" | ALERTA | Igual que el de Ventas |

### Servicios (`components/servicios-catalogo.tsx`)

| Línea | Título | Tipo | Acción |
|---|---|---|---|
| 155 | `ServicioDialog` | FORM | Paso 1 (blanco→accent) + Card+Eyebrow. El checkbox "Servicio activo" (ver CLAUDE.md) usa el nuevo patrón de checkbox-en-bloque del Paso 4 |

### Reportar un problema (`components/reportar-bug-fab.tsx`)

| Línea | Título | Tipo | Acción |
|---|---|---|---|
| 44 | "Reportar un problema" | FORM | Paso 1 + Card+Eyebrow si tiene más de un campo; si es un solo textarea, ver nota "modales chicos" |

## Paso 3 — Patrón concreto a replicar en cada FORM

Mirar `ventas-client.tsx:1696-1745` como plantilla exacta:

```tsx
<div className="space-y-5">
  <Card className="p-4">
    <Eyebrow>Nombre de la sección</Eyebrow>
    {/* campos de esta sección */}
  </Card>
  <Card className="p-4">
    <Eyebrow>Otra sección</Eyebrow>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Field label="Campo corto" labelClassName="text-center">
        <Select className="text-center">...</Select>
      </Field>
      {/* ... */}
    </div>
  </Card>
</div>
```

Reglas puntuales:

- **Agrupar por sección lógica**, no por campo — un form de 2-3 campos
  relacionados entre sí (ej. `CajaDialog`: nombre + moneda + medio de pago)
  va en **una sola Card**, no en Cards individuales por campo. Si un dialog
  chico (`Invitar usuario`, un solo campo email) no tiene más de un grupo
  lógico, **no hace falta envolverlo en Card** — el body del `Dialog` ya
  tiene su propio padding; forzar una Card de un solo campo es ruido visual
  de más. Usá criterio: ¿tiene 2+ agrupaciones de campos como Nueva venta
  (Cliente / Datos de la venta / Ítems / Pago)? Si sí, Cards. Si es
  literalmente 1-2 campos sueltos, dejalo simple.
- **Labels**: `<Field label="..." labelClassName="text-center">` — no
  cambiar el default de `Field`/`Label` (que sigue alineado a la izquierda
  para toolbars/filtros fuera de dialogs); esto es un override puntual por
  instancia, igual que lo hace Nueva venta hoy.
- **Selects / inputs de valor corto** (número, fecha, hora, selects de
  opciones): `<Select className="text-center">` / `<Input className="text-center">`.
- **Inputs de texto libre** (nombre, email, teléfono, dirección, textarea de
  notas/aclaraciones/descripción): **sin** `text-center` — quedan con el
  alineado izquierdo default de `Input`/`Textarea`.
- **Checkboxes** ("activo", flags booleanos dentro de un form — ver
  `ServicioDialog` "Servicio activo" en CLAUDE.md): el bloque
  checkbox+texto se centra como conjunto. Patrón sugerido (adaptar el
  layout exacto al form, esto es una guía no una clase obligatoria):

  ```tsx
  <label className="flex flex-col items-center gap-1.5 text-center text-sm font-medium text-neutral-700">
    <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent" />
    Servicio activo
  </label>
  ```

  (Nota: esto es distinto del checkbox de `ConfirmDialog` del Paso 0, que
  además lleva borde de card — acá es un flag suelto dentro de un form, sin
  necesidad de esa caja.)

## Paso 4 — Dialogs de detalle: qué auditar

Para cada DETALLE de la tabla del Paso 2, chequear contra el patrón ya
documentado en CLAUDE.md ("Header violeta... dialogs de detalle/vista...
grid grid-cols-3 gap-3, cada celda `<Card className="p-3 text-center">`
con label `font-grotesk border-b border-neutral-300 ... uppercase` + valor
`mt-2 text-sm`"):

- ¿El bloque "Información general" usa esa grilla de 3 columnas con Cards
  centradas? Si usa otra cosa (lista de pares label/valor sin Card, texto
  suelto, etc.), migrarlo a ese patrón.
- ¿Hay texto que debería estar centrado y no lo está (labels de esas
  celdas, valores cortos)? Corregir puntualmente.
- **No** reescribir bloques que ya cumplen solo para que "se vea más
  parecido a Nueva venta" — Nueva venta es la referencia para los FORM, el
  patrón grid-cols-3 ya documentado es la referencia para los DETALLE. Son
  dos patrones distintos a propósito (uno es de captura de datos, el otro
  de solo-lectura).

## Paso 5 — Actualizar CLAUDE.md

En la sección `Dialog`: todos los de una sección son una sola familia
visual":

- Sacar la mención de que hay dos familias (header violeta vs. header
  blanco) — ya no existen dialogs de header blanco en la app. Dejar
  documentada **una sola familia**: header accent + footer de pills, para
  **todo** dialog nuevo de acá en adelante.
- Documentar el patrón de Card+Eyebrow por sección dentro de un form
  (mencionar `components/ui/eyebrow.tsx` como el componente a importar, no
  a copiar) y la regla de texto centrado: labels + valores cortos
  centrados, texto libre a la izquierda — dejar explícito que esto es una
  excepción acotada a los **forms dentro de dialogs**, no cambia la regla
  general "Fuera de tablas, alinear a la izquierda con `text-start`" para
  el resto de la UI (toolbars, filtros, texto de página).
- Documentar el patrón de checkbox-en-bloque (centrado) para flags dentro
  de un form, y el prop `checks` nuevo de `ConfirmDialog` para
  confirmaciones con checkboxes.
- Actualizar la referencia a `ServicioDialog`/`NuevoClienteDialog`/
  `NuevoTicketDialog` como ejemplos de "sin `accent` todavía" — ya no
  aplica.

**No tocar** la sección "Pendiente de resolver" sobre `text-center` en
**tablas** (`AUDIT.md`) — es una decisión de producto distinta, sobre
columnas de tabla, no sobre dialogs. No mezclar los dos temas en el mismo
commit ni en el mismo párrafo de CLAUDE.md.

## Fuera de alcance — no tocar

- `components/command-palette/command-palette.tsx` — no es un `Dialog`
  (es un overlay tipo spotlight con su propia spec, ver
  `plan-buscador-comandos.md` si todavía existe), no le aplica este plan.
- El punto pendiente de `AUDIT.md` sobre `text-center` en **tablas** — tema
  aparte, ver Paso 5.
- Los `Badge`/tonos de `lib/status.ts`, `GHOST_STRIPES`, colores
  emerald/red de `Delta` — no son parte de este rework.
- No cambiar el default de `Field`/`Label`/`Input`/`Select` (fuera de los
  overrides puntuales por instancia) — un cambio global rompería el
  alineado izquierdo de toolbars y filtros fuera de dialogs.

## Paso 6 — Verificación

1. `npx tsc --noEmit` y `npx vitest run` — cero errores nuevos (este rework
   es puramente visual/estructural, no debería tocar lógica ni tests).
2. Manual en `npm run dev` (puerto 3100), recorriendo **cada** dialog de la
   tabla del Paso 2:
   - Abrir cada FORM (alta y edición donde aplique) y confirmar: header
     índigo, Eyebrows centrados con línea, labels centrados, selects/inputs
     cortos centrados, campos de texto libre siguen legibles a la
     izquierda, checkboxes centrados como bloque.
   - Abrir cada DETALLE y confirmar que sigue viéndose bien (no debería
     haber cambiado, salvo los que tenían un desvío real).
   - Las 2 alertas "El monto no coincide" (Ventas y Reparaciones).
   - Las 11 confirmaciones de `ConfirmDialog` (buscar cada `<ConfirmDialog`
     en el repo) — header ahora accent, y las 2 con checkboxes
     (Ventas/Compras) con el nuevo patrón en bloque.
   - Riesgo conocido: `<select>` nativo con `text-align: center` no se
     renderiza igual en todos los navegadores/SO (Windows en particular
     puede ignorar el centrado del texto seleccionado, aunque sí centra las
     `<option>` de la lista desplegada en Chrome/Edge). Probar al menos en
     Chrome; si en algún SO se ve mal, es un compromiso conocido del
     `<select>` nativo, no un bug de la implementación — dejarlo anotado en
     el PR/commit, no bloquear por esto.
3. Confirmar que ninguna sección de tabla (`text-center`/`text-start` de
   `th`/`td`) cambió — este plan es exclusivamente sobre dialogs.
