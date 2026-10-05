# 011 — Modales: pasar todo el sistema al estilo "vidrio"

**Status:** HECHO en código (falta verificación visual /qa/dialog y modales con sesión)
**Scope:** `components/ui/dialog.tsx` (+ `confirm-dialog.tsx`) y los ~40 usos de `<Dialog>` en 14 archivos. Sin cambios de datos, server actions ni lógica de negocio.

## Contexto

«Nuevo movimiento» de Cajas ya se probó y **se aprobó** con `<Dialog variant="glass">`:
header oscuro (`bg-table-header`) con texto blanco, panel `bg-white/80
backdrop-blur-2xl backdrop-saturate-200`, overlay `bg-neutral-900/[0.07]
backdrop-blur-[2px]`, borde `accent/70`, y el `Dialog` ahora se monta con
`createPortal` en `document.body` (el overlay cubre toda la ventana). Este
plan extiende ese look a **todos** los modales y retira la bifurcación
`accent` / blanco / `glass`.

Inventario de usos (`<Dialog`): cajas 4 · inventario 6 · reparaciones 6 ·
ventas 4 · clientes 2 · compras 2 · configuración 2 · cuentas-corrientes 2 ·
difusión 2 · turnos 2 · recuentos 1 · `servicios-catalogo` 1 ·
`reportar-bug-fab` 1 · `ConfirmDialog` (envuelve `Dialog`, usado en 10
archivos, incl. `app/admin/organizaciones/[id]`).
**No son `Dialog` y quedan fuera:** `AuthModal` (login/signup), `CommandPalette`
(overlay propio `bg-neutral-900/30`), `bienvenida` (celebración a pantalla
completa), `MobileNavDrawer`.

## Decisiones (ya tomadas)

1. **Un solo look**: el vidrio pasa a ser el default del `Dialog`. Se eliminan
   las props `variant` y `accent` (hoy 34 usos de `accent` — se borran, no se
   migran). Header siempre oscuro.
2. **Opacidad por tamaño**: `size` md/lg → `bg-white/80`. `xl`/`2xl` (detalles
   y «Nueva venta», con tablas y mucho texto) → `bg-white/90`, para que el
   fondo desenfocado no compita con contenido denso.
3. **Formularios**: pares cortos (Tipo/Caja, Categoría/Monto, fechas, etc.)
   pasan a `grid grid-cols-1 gap-3.5 sm:grid-cols-2`; campos largos
   (Concepto, Descripción, cliente) `sm:col-span-2`. Los diálogos de
   **detalle** (ficha de cliente, ticket, venta) conservan su estructura
   interna; solo cambia el contenedor.
4. **Footer**: sin cambios (`Button` outline + primary, `fullOnMobile`).
5. **Overlay anidado** (`ConfirmDialog` sobre otro dialog): el overlay del
   segundo **no** vuelve a blurrear (solo oscurece al 7 %); un blur doble sobre
   blur ya hecho se ve sucio.

## Pasos

### 1. `components/ui/dialog.tsx`
- Quitar `variant` y `accent`; el estilo glass pasa a ser el único.
- Overlay: `bg-neutral-900/[0.07] backdrop-blur-[2px]`; si hay otro dialog
  abierto debajo (contador `openDialogs > 1` ya existente en `lockScroll`),
  usar `backdrop-blur-none` para el de arriba. Exponer el contador con una
  función `isNested()` o leerlo al abrir.
- Panel: `bg-white/80` (md/lg) o `bg-white/90` (xl/2xl) según `size`.
- Los `[&_input]/[&_select]/[&_textarea]` que re-estilan campos (42 px, radio
  14 px, `bg-white/70`) **se aplican siempre** al body (hoy solo existían en la
  rama glass que se retiró: reponerlos en el `className` del body).
- Mantener: portal + `mounted`, `animate-modal-in/out`, scroll lock, Esc,
  `aria-label="Cerrar"`. Agregar `role="dialog" aria-modal="true"
  aria-labelledby` (hoy falta; se aprovecha el cambio).
- Safari: `backdrop-blur-*` de Tailwind 3 ya emite `-webkit-backdrop-filter`.
  Verificar visualmente en un navegador WebKit si hay uno disponible.

### 2. Migrar usos (una sección por commit, en este orden)
Para cada archivo: quitar `accent` y `variant="glass"`, pasar los forms a la
grilla de 2 columnas (decisión 3) y revisar que ningún `key` de reseteo cambie.
1. `cajas-client.tsx` (4) — «Nuevo movimiento» ya está; seguir con `CajaDialog`,
   `ConciliarDialog`, detalle de movimiento.
2. `clientes-client.tsx`, `cuentas-corrientes-client.tsx` (forms simples).
3. `compras-client.tsx`, `turnos-client.tsx`, `recuentos-client.tsx`,
   `configuracion-client.tsx`, `difusion-client.tsx`, `servicios-catalogo.tsx`,
   `reportar-bug-fab.tsx`.
4. `inventario-client.tsx` (6) y `reparaciones-client.tsx` (6) — los más
   densos: `EquipoFormDialog`, Ingreso/Recuento, ticket (checklist en
   grilla de 3: no tocar), `AgregarItemDialog`.
5. `ventas-client.tsx` (4) — «Nueva venta» (`size xl`/`2xl`, tarjetas de pago
   divididas y buscador de ítems con dropdown `absolute`: **sin
   `overflow-hidden`** en el panel, ya está así a propósito) y `VentaDetalle`,
   `CanjeModal`.
6. `ConfirmDialog` y su uso en `app/admin/organizaciones/[id]` (no cambia el
   código, solo se revisa que se vea bien).

### 3. Casos a vigilar
- **Dropdowns que sobresalen** (`ClientePicker`, `ItemBuscador`, menú
  «Imprimir ▾»): con el panel traslúcido tienen que seguir pintando por encima
  y **opacos** (`bg-white`). Revisar z-index dentro del portal.
- **Impresión** (`@media print` en `app/globals.css` oculta todo salvo
  `.recibo-print`): como el dialog ahora vive en `<body>`, confirmar que un
  dialog abierto no se imprime junto con el recibo (los recibos ya cierran el
  dialog antes de imprimir; verificar Ventas → Garantía/Comprobante y
  Reparaciones → tickets).
- **Contraste**: texto `text-neutral-500` sobre `white/80` + fondo
  desenfocado sigue ≥ 4.5:1 en el peor caso (fondo con la banda índigo de la
  tabla detrás). Si falla en `md`, subir ese caso a `white/90`.
- **Rendimiento**: `backdrop-filter` en paneles grandes (`2xl`) en equipos
  modestos; si se nota lag al scrollear dentro del modal, bajar `blur-2xl` a
  `blur-xl` solo en `xl`/`2xl`.
- **Mobile (390/360 px)**: grillas colapsan a 1 columna; el header con
  descripción no debe superar ~3 líneas.

### 4. Galería de QA
Ampliar `app/qa/dialog/` (solo dev) con un dialog por tamaño (`md`, `lg`, `xl`,
`2xl`), uno con dropdown abierto, uno anidado (`ConfirmDialog` encima) y uno
sin footer, para revisar el sistema completo sin sesión.

### 5. Docs
- `CLAUDE.md`: reescribir la fila de `Dialog` en "Otros primitivos" (sin
  `accent`/`variant`, vidrio único, opacidad por `size`) y la sección
  "`Dialog`: footer con el sistema único de botones" (sacar la mención a
  header violeta vs blanco). Quitar la nota de "prueba".
- Actualizar `plans/README.md` y borrar este plan cuando esté verificado.

## Verificación
1. `npx tsc --noEmit` y `npx vitest run` limpios (no debe quedar ningún
   `accent` ni `variant=` en un `<Dialog>`: `grep -rn "<Dialog" -A6 app
   components | grep -E "accent|variant"` vacío).
2. `/qa/dialog` a 1440, 1080, 390 y 360 px: blur hasta el borde superior,
   header oscuro, panel traslúcido sin grises sucios.
3. Con sesión (a cargo del usuario): abrir cada modal de la lista (≈ 40) y
   confirmar scroll, Esc, click fuera, dropdowns, impresión de recibos y el
   `ConfirmDialog` encima de un dialog.

## Fuera de alcance
`AuthModal`, `CommandPalette`, `bienvenida`, `MobileNavDrawer`; rediseño del
contenido interno de los diálogos de detalle; modo oscuro.
