# Plan: buscador de comandos global ("acciones rápidas")

## Contexto

Hoy, para hacer algo como "nueva venta" o "agendar turno" hay que navegar a
la sección correspondiente y buscar el botón de alta en su toolbar. El
usuario quiere un buscador global tipo Superhuman/Linear ("super espacio"):
un punto de entrada fijo, siempre visible en cualquier página de `(app)`,
que abra un buscador con las acciones rápidas del negocio (Nueva venta,
Agendar turno, Nuevo cliente, Nuevo ticket, Nuevo movimiento de caja, Nueva
compra, Registrar pago) y las ejecute con un click o Enter, sin tener que
navegar manualmente primero.

Decisiones ya confirmadas con el usuario (no volver a preguntarlas):

1. **Entrada al buscador**: botón "+" grande, fijo, abajo a la derecha
   (`fixed bottom-6 right-6`) **+** atajo `Cmd/Ctrl+K` como alternativa para
   power users. Ambos abren el mismo overlay. La esquina inferior derecha
   está libre hoy (`SimPanel` y `ReportarBugFab` están los dos abajo a la
   **izquierda**, `bottom-20 left-6` y `bottom-6 left-6` respectivamente) —
   no hay colisión visual.
2. **Acciones incluidas en esta v1** (7): Nueva venta, Nuevo cliente, Nuevo
   ticket, Nuevo movimiento de caja, Agendar turno, Nueva compra, Registrar
   pago (cuenta corriente, sin cliente preseleccionado).
3. **Filtrado por rol**: cada acción hereda el `roles` de la entrada
   correspondiente en `lib/nav.ts` (mismo criterio que el menú principal).

## Por qué no alcanza con lo que ya existe

Cada dialog de alta (`NuevaVentaDialog`, `ClienteFormDialog`,
`NuevoTicketDialog`, `NuevoMovimientoDialog`, `AgendarDialog`,
`NuevaCompraDialog`, `NuevoMovimientoCCDialog`) vive como estado local
`"use client"` **dentro del client component de su propia sección** — no
hay ningún estado global. Para abrir "Nueva venta" estando en el Dashboard
hay que: navegar a `/ventas` y, una vez ahí, decirle a `ventas-client.tsx`
que abra el dialog solo.

Ya existe un precedente parecido: Compras lee `?open=<id>` y Configuración
lee `?tab=` con `useSearchParams`, pero ambos lo usan como **valor inicial
de un `useState`** (`useState(searchParams.get("open"))`). Ese patrón tiene
un bug latente para este caso de uso: si el usuario ya está parado en
`/ventas` y abre el buscador para disparar "Nueva venta" de nuevo, Next.js
**no remonta** el componente (misma ruta) — el `useState` inicial no se
vuelve a evaluar y el dialog nunca se abre la segunda vez. Por eso el
mecanismo nuevo usa un `useEffect` que reacciona al valor de
`searchParams` (no solo el mount inicial) — ver siguiente sección.

## Mecanismo central: `?accion=<id>` + `useEffect` + limpiar el param

Un solo query param, `accion`, con un valor por acción (igual al `id` de
`QuickAction`, ver abajo). El buscador simplemente hace
`router.push(action.href)` (ej. `/ventas?accion=nueva-venta`). Next.js
monta la página si es una ruta distinta, o solo re-renderiza si ya estás
en esa ruta — en los dos casos `useSearchParams()` cambia y un `useEffect`
que dependa de él se dispara.

Patrón a agregar en **cada** client component de sección (7 veces, mismo
shape, cambia el nombre del setter y el valor de `accion`):

```tsx
const searchParams = useSearchParams();
const router = useRouter();

useEffect(() => {
  if (searchParams.get("accion") !== "nueva-venta") return;
  setCreating(true);
  router.replace("/ventas"); // limpia el param -- evita reabrir con back/refresh
}, [searchParams, router]);
```

`router.replace` (sin el query param) es clave: si no se limpia, volver
atrás con el botón del navegador o refrescar reabre el dialog solo.

**Importante**: esto es un `useEffect` **nuevo e independiente** en cada
archivo — no modificar ni refactorizar el `useState(searchParams.get(...))`
que ya existe en Compras (`?open=`) o Configuración (`?tab=`). Los dos
mecanismos conviven sin tocarse.

## Archivos nuevos

### `lib/command-palette.ts`

Módulo puro (sin Supabase, sin `"server-only"`), mismo criterio que
`lib/nav.ts`:

```ts
export type QuickAction = {
  id: string;            // también el valor del query param `?accion=`
  label: string;
  keywords: string[];    // términos extra para el buscador (sinónimos)
  icon: LucideIcon;
  href: string;           // ej. "/ventas?accion=nueva-venta"
  roles?: Rol[];          // copiado de la entrada correspondiente en lib/nav.ts
};

export const QUICK_ACTIONS: QuickAction[] = [
  { id: "nueva-venta", label: "Nueva venta", keywords: ["vender"], icon: ShoppingCart, href: "/ventas?accion=nueva-venta" },
  { id: "nuevo-cliente", label: "Nuevo cliente", keywords: ["alta cliente"], icon: Users, href: "/clientes?accion=nuevo-cliente" },
  { id: "nuevo-ticket", label: "Nuevo ticket", keywords: ["reparación", "reparar"], icon: Wrench, href: "/reparaciones?accion=nuevo-ticket" },
  { id: "nuevo-movimiento-caja", label: "Nuevo movimiento de caja", keywords: ["ingreso", "egreso", "efectivo"], icon: Wallet, href: "/cajas?accion=nuevo-movimiento-caja", roles: ["admin", "tecnico"] },
  { id: "agendar-turno", label: "Agendar turno", keywords: ["cita", "agenda"], icon: CalendarClock, href: "/turnos?accion=agendar-turno" },
  { id: "nueva-compra", label: "Nueva compra", keywords: ["proveedor"], icon: ShoppingBag, href: "/compras?accion=nueva-compra", roles: ["admin", "tecnico"] },
  { id: "registrar-pago", label: "Registrar pago", keywords: ["cuenta corriente", "cobro", "fiado"], icon: BookUser, href: "/cuentas-corrientes?accion=registrar-pago", roles: ["admin", "tecnico"] },
];

export function quickActionsForRole(rol: Rol): QuickAction[] {
  return QUICK_ACTIONS.filter((a) => !a.roles || a.roles.includes(rol));
}

export function filterQuickActions(actions: QuickAction[], query: string): QuickAction[] {
  // normalizar minúsculas + sin tildes en `query` y en label/keywords antes
  // de comparar con .includes() -- ver lib/clientes.ts o similar si ya hay
  // un normalizador de texto reusable en el repo; si no, implementarlo acá.
}

export function defaultTurnoSlot(now: Date = new Date()): { dayOffset: number; hora: string } {
  // HORAS de turnos-client.tsx va de "09:00" a "20:00" cada 30 min (línea
  // ~43-48, ver Array.from({length:23},...)). Esta función devuelve el
  // próximo horario redondeado a 30 min dentro de ese rango:
  // - antes de las 9:00 -> { dayOffset: 0, hora: "09:00" }
  // - 9:00-19:59 -> hoy, hora actual redondeada hacia arriba a los 30 min,
  //   sin pasar de "20:00"
  // - 20:00 en adelante -> { dayOffset: 1, hora: "09:00" } (mañana a primera hora)
}
```

Los `roles` de cada acción son una copia 1:1 de la entrada correspondiente
en `lib/nav.ts` (`NAV`): `/cajas`, `/compras` y `/cuentas-corrientes` llevan
`roles: ["admin", "tecnico"]`; el resto no lleva `roles` (visible a los 3).

### `lib/command-palette.test.ts`

`vitest`, sin red, cubriendo:
- `filterQuickActions`: matchea por `label`, matchea por `keywords`,
  insensible a mayúsculas/tildes (ej. "reparacion" sin tilde debe matchear
  "Nuevo ticket" vía keyword "reparación"), sin resultados para query que no
  matchea nada.
- `defaultTurnoSlot`: casos con `now` inyectado — antes de las 9, en medio
  del rango (verificar redondeo a 30 min), exactamente a las 20:00, después
  de las 20:00.

### `components/command-palette/command-palette.tsx`

`"use client"`. Un solo componente que renderiza:

1. **El botón flotante**: `fixed bottom-6 right-6 z-40` (mismo nivel que
   `ReportarBugFab`), círculo grande (`h-14 w-14 rounded-full`), ícono
   `Plus` de `lucide-react` centrado, fondo con el gradiente índigo del
   `Button variant="primary"` (`components/ui/button.tsx` — reusar esos
   mismos valores de `background`/`shadow`/hover, es el único gradiente
   permitido por el sistema de diseño, ver CLAUDE.md "Forbidden defaults").
   `aria-label="Buscar una acción"` (es un control solo-ícono).

2. **El overlay**, montado solo cuando `open === true`: mismo lenguaje
   visual que `Dialog` (`components/ui/dialog.tsx`) pero NO es un `Dialog`
   (ese tiene header/footer de formulario, esto es más tipo spotlight):
   - Backdrop: `fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-[2px]`,
     `onClick` cierra.
   - Caja centrada arriba (no en el medio vertical): `mx-auto mt-[12vh]
     w-full max-w-lg px-4`, `onClick` con `stopPropagation`.
   - Panel: `animate-toast-in overflow-hidden rounded-2xl border
     border-neutral-200 bg-white shadow-2xl` (mismas clases que el modal de
     `Dialog`).
   - Input de búsqueda arriba: ícono `Search` + `<input autoFocus>`, sin
     borde propio (se integra al panel), placeholder "Buscar una acción…".
   - Lista de resultados debajo (`border-t border-neutral-100`,
     `max-h-80 overflow-y-auto`): una fila por `QuickAction` visible
     (ícono + label), fila resaltada (`highlightedIndex`) con
     `bg-accent-soft` (no `bg-neutral-100` — ese tono ya está reservado
     para hover/activo en el resto de la app). Sin resultados → texto
     centrado "Sin resultados" (mismo criterio ad-hoc que el resto de la
     app, no hay componente `EmptyState` compartido).
   - Footer chico opcional: hint de teclado ("↑↓ para navegar · Enter para
     elegir · Esc para cerrar"), `text-[11px] text-neutral-400`.

3. **Estado y teclado** — todo en un solo `useEffect` con listener en
   `window` (siempre montado, chequea `open` adentro):
   - `Cmd+K` / `Ctrl+K` (`e.metaKey || e.ctrlKey`, `e.key.toLowerCase() ===
     "k"`) → `e.preventDefault()`, toggle `open`. Es el primer atajo global
     del proyecto — no hay ningún otro `keydown` a nivel `window` con el
     que pueda chocar (confirmado, no existe ninguno hoy).
   - Con `open === true`: `Escape` cierra, `ArrowDown`/`ArrowUp` mueven
     `highlightedIndex` (clamped a los límites de la lista filtrada),
     `Enter` selecciona la fila resaltada. Todos con `preventDefault`.
   - Al pasar `open` de `false` a `true`: resetear `query` a `""` y
     `highlightedIndex` a `0` (mismo criterio que el resto de la app usa
     `key={...}` para resetear dialogs al reabrir).
   - Scroll lock mientras `open`: exportar `lockScroll`/`unlockScroll` de
     `components/ui/dialog.tsx` (hoy son funciones privadas del módulo, no
     exportadas) y llamarlas desde un `useEffect([open])` — **es el único
     cambio a `dialog.tsx`: agregar la palabra `export` a esas dos
     funciones, nada más, no tocar ninguna otra línea de ese archivo.**
   - Al seleccionar una acción (click o Enter): `setOpen(false)` y
     `router.push(action.href)`.

4. **Prop**: `rol: Rol` (viene del `SessionUser` del layout) — se usa para
   `quickActionsForRole(rol)`; el filtro por texto (`filterQuickActions`)
   se aplica sobre ese subconjunto ya filtrado por rol.

## Integración con el resto de la app

### `app/(app)/layout.tsx`

Único cambio: importar `CommandPalette` y renderizarlo como hermano de
`<SimPanel />`/`<ReportarBugFab />` (mismo nivel, dentro de
`RealtimeProvider`), pasándole `rol={user.rol}`:

```tsx
<CommandPalette rol={user.rol} />
```

No tocar nada más de ese archivo (ni el orden de los otros componentes, ni
`RealtimeProvider`, ni `TopNav`).

### Wiring por sección (7 archivos, mismo patrón del bloque de código de
arriba — cambia el `id` de la acción y qué se setea)

| Archivo | `accion` | Qué hace el efecto |
|---|---|---|
| `app/(app)/ventas/ventas-client.tsx` | `nueva-venta` | `setCreating(true)` |
| `app/(app)/clientes/clientes-client.tsx` | `nuevo-cliente` | `setCreating(true)` |
| `app/(app)/reparaciones/reparaciones-client.tsx` | `nuevo-ticket` | `setCreating(true)` |
| `app/(app)/cajas/cajas-client.tsx` | `nuevo-movimiento-caja` | `setNuevoOpen(true)` |
| `app/(app)/turnos/turnos-client.tsx` | `agendar-turno` | `setSlot(defaultTurnoSlot())` (importado de `lib/command-palette.ts`) |
| `app/(app)/compras/compras-client.tsx` | `nueva-compra` | `setCreating(true)` — **agregar como efecto nuevo separado**, sin tocar el `useState(openParam)` existente de la línea ~66-70 |
| `app/(app)/cuentas-corrientes/cuentas-corrientes-client.tsx` | `registrar-pago` | `setNuevoDefault({ tipo: "pago" })` + `setNuevoOpen(true)` — **verificar el tipo exacto de `nuevoDefault` (línea ~56-59) antes de escribir esto**: si `clienteId` es opcional y `tipo` también, pasar `{ tipo: "pago" }` sin `clienteId` (el picker de cliente del dialog debe quedar vacío/editable); si `tipo` no es opcional en el tipo, usar el valor que ya use el flujo existente de "Registrar pago" desde la ficha de cliente |

En los 7 archivos, agregar el import de `useSearchParams`/`useRouter` de
`next/navigation` si no está ya importado (todos son `"use client"`, así
que el hook funciona sin cambios de arquitectura), y el import de lo que
haga falta de `lib/command-palette.ts` (solo `turnos-client.tsx` necesita
`defaultTurnoSlot`).

## Fuera de alcance — no tocar

- El `useState(searchParams.get("open"))` de Compras ni el `?tab=` de
  Configuración — quedan intactos, el nuevo `useEffect` es independiente.
- `components/notifications/sim-panel.tsx` y `components/reportar-bug-fab.tsx`
  — no cambiar su posición ni estilo.
- `components/ui/dialog.tsx` — el único cambio permitido es agregar
  `export` a `lockScroll`/`unlockScroll`. No tocar el resto del archivo.
- `lib/nav.ts` / `navForRole` / `NAV` — no modificar, solo leer los `roles`
  para copiarlos a `lib/command-palette.ts`.
- No instalar ninguna librería (`cmdk`, `fuse`, etc.) — confirmado que no
  hay ninguna ya instalada y no hace falta, el filtro es un `.includes()`
  normalizado a mano.
- No usar `lib/realtime.ts` / `publish(...)` — esto no es un evento que
  otros usuarios deban ver, es puramente navegación local del que lo usa.
- No agregar el buscador a `/login`, `/signup`, `/forgot-password`,
  `/reset-password` (fuera del grupo `(app)`, sin sesión no aplica).
- No resolver colisión de horario en `defaultTurnoSlot` contra turnos ya
  agendados — devuelve un horario razonable, no necesariamente libre; igual
  que clickear un slot ocupado en el calendario, el dialog se abre igual.

## Verificación

1. `npx tsc --noEmit` y `npx vitest run` (incluye `lib/command-palette.test.ts`
   nuevo) — cero errores nuevos.
2. Manual en `npm run dev` (puerto 3100):
   - Abrir el buscador con el botón y con `Cmd/Ctrl+K`, desde el Dashboard.
   - Navegar con flechas, seleccionar con Enter, cerrar con Escape y con
     click afuera.
   - Probar las 7 acciones una por una: cada una navega a su sección y
     abre el dialog correspondiente ya vacío (o con el slot/tipo default en
     Turnos/Cuentas corrientes).
   - Caso clave: parado YA en `/ventas`, abrir el buscador y elegir "Nueva
     venta" de nuevo — tiene que reabrir el dialog (valida el `useEffect`
     sobre `searchParams`, no el bug del `useState` inicial).
   - Después de elegir una acción, confirmar que la URL quedó limpia (sin
     `?accion=`) y que el botón "atrás" del navegador no reabre el dialog
     solo.
   - Con un usuario `vendedor`, confirmar que "Nuevo movimiento de caja",
     "Nueva compra" y "Registrar pago" NO aparecen en la lista.
