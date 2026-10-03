# 003 — Buscador global (Cmd+K con resultados en vivo + estilo "liquid glass")

- **Status**: TODO
- **Scope**: extender el Cmd+K que ya existe (no crear uno nuevo) +
  `lib/db/busqueda.ts` nuevo + deep-links `?q=` en 4 secciones + resktyle
  visual del panel. Sin migraciones de base.
- **Category**: feature nueva sobre componente existente

## Contexto

El usuario pidió un buscador global, estilo "liquid glass", que aparezca
centrado en pantalla al clickear un botón de buscar o con una combinación de
teclas, y que busque tanto acciones/configuración como datos reales (ventas,
clientes, movimientos, etc).

**Ya existe un Cmd+K** en el repo — no hay que construirlo de cero:
`lib/command-palette.ts` (`QUICK_ACTIONS`, `filterQuickActions`,
`quickActionsForRole`) + `components/command-palette/command-palette.tsx`
(atajo `Cmd/Ctrl+K`, modal centrado `mt-[12vh]`, botón flotante `+` abajo a
la derecha que también lo abre, navegación con flechas/Enter/Esc). Hoy solo
busca una lista fija de 7 "acciones rápidas" (Nueva venta, Nuevo cliente,
etc.) — nada de navegación ni datos reales. Este plan lo **extiende**, no lo
reemplaza.

Decisiones ya tomadas con el usuario:

- **Liquid glass permitido**: CLAUDE.md prohibía `glassmorphism` como
  "forbidden default" de la app de gestión (ver sección "Forbidden
  defaults") — el usuario pidió explícitamente sacar esa restricción y ya
  se removió esa palabra de CLAUDE.md (línea de "Forbidden defaults", no
  hace falta tocarla de nuevo). El Cmd+K puede usar vidrio esmerilado.
- Mismo atajo/triggers que ya existen (Cmd/Ctrl+K + el botón flotante) —
  no hace falta agregar un tercer disparador.

## Diseño

### 1. Backend de búsqueda: `lib/db/busqueda.ts` (nuevo, `server-only`)

Sigue el patrón de `lib/db/<dominio>.ts` — **sin** service role: usa
`createServerClient()` normal, así que respeta RLS solo (cada org busca
solo en sus propios datos, gratis, sin filtrar `organization_id` a mano).

```ts
export type ResultadoBusqueda = {
  tipo: "cliente" | "venta" | "ticket" | "equipo" | "movimiento_caja";
  id: string;
  titulo: string;
  subtitulo: string;
  href: string;
};

export async function buscarGlobal(query: string): Promise<ResultadoBusqueda[]>
```

Query mínima (2+ caracteres, si no `[]`), 5 resultados por tabla, en
paralelo (`Promise.all`) contra:
- `clientes` (`nombre`/`telefono` ilike) → `href: /clientes?open=<id>`
  (el `?open=` **ya existe**, ver `clientes-client.tsx:40`).
- `ventas` (`cliente` ilike, o `numero` si `query` es numérico) →
  `href: /ventas?q=<query>` (ver "Deep links" abajo — no abre el detalle
  directo en este alcance, ver "Qué NO construir").
- `tickets` (`equipo`/`imei`/`falla` ilike) → `href: /reparaciones?q=<query>`.
- `equipos` (`modelo`/`imei` ilike) → `href: /inventario?tab=equipos&q=<query>`.
- `movimientos_caja` (`concepto` ilike) → `href: /cajas?q=<query>`.

Cada bloque de resultado trae su propio label para la UI (ej. "Clientes",
"Ventas", …) — no hace falta un campo de label en el tipo, el componente
agrupa por `tipo`.

### 2. Server action: `app/(app)/actions.ts`

Agregar (mismo archivo que ya tiene `signOutAction`/`updateOwnProfileAction`,
acciones transversales a toda la app, no de un dominio):

```ts
export async function buscarGlobalAction(query: string): Promise<ResultadoBusqueda[]> {
  await requireUser();
  return buscarGlobal(query);
}
```

No es una mutación — no necesita `revalidatePath`, pero sí `requireUser()`
primero (mismo criterio que toda action de este archivo).

### 3. `lib/command-palette.ts` — agregar búsqueda de navegación local

Nueva función pura (con test, ej. `filterNavItems`) que filtra `NAV`
(`lib/nav.ts`) por label normalizado, igual criterio que
`filterQuickActions` — resultados de "Ir a sección" son instantáneos, sin
red. Reusar `navForRole` para el filtro por rol ya existente.

### 4. `components/command-palette/command-palette.tsx` — reescritura de la UI

- **Debounce** (300ms) sobre `query`: dispara `buscarGlobalAction` solo si
  `query.trim().length >= 2`, vía `useTransition` + estado de resultados en
  vivo. Mientras no hay texto o es muy corto, se muestran solo los
  resultados locales (acciones rápidas + nav), sin red.
- **Secciones agrupadas** en el panel: "Ir a" (nav), "Acciones rápidas"
  (`QUICK_ACTIONS`), y una sección por `tipo` de `ResultadoBusqueda` que
  tenga resultados (Clientes/Ventas/Tickets/Equipos/Movimientos) — cada
  sección con su mini-título (`text-[11px] uppercase text-neutral-500`,
  mismo tratamiento que labels de la app).
  - Elevador de teclado (↑↓/Enter) tiene que recorrer la lista combinada
    aplanada (nav + quick actions + resultados en vivo), manteniendo el
    `highlightedIndex` existente — no una lista separada por sección.
- **Loading state**: mientras el debounce/la request está en curso, un
  indicador discreto (ej. un `Loader2 animate-spin` chico al lado del
  ícono de lupa) — no bloquear el input ni el teclado.

### Estilo "liquid glass"

Reemplaza el overlay/panel sólido actual (`bg-neutral-900/40
backdrop-blur-[2px]` + panel `bg-white` opaco) por:

```
Overlay: bg-neutral-900/30 backdrop-blur-md backdrop-saturate-150
Panel:   bg-white/70 backdrop-blur-xl
         ring-1 ring-white/60 (highlight sutil en el borde superior)
         shadow-[0_8px_40px_rgba(0,0,0,0.25)] (sombra suave, sin borde duro)
         rounded-2xl (ya lo tiene)
```

Ojo: el panel tiene texto/filas encima (resultados) — probar legibilidad
de `text-neutral-900`/`text-neutral-500` sobre `bg-white/70` con blur; si
hace falta, subir la opacidad del panel (`/80`) en vez de bajar el blur,
para no perder el efecto.

## Deep links a agregar (`?q=` en 4 secciones)

`clientes`/`compras` ya soportan `?open=<id>` — no se tocan. Faltan agregar
el leer-de-URL en el `useState("")` del buscador de cada sección (mismo
patrón que `openParam` de `clientes-client.tsx:40`, pero prefillenado el
query box en vez de abrir un dialog):

| Sección | Archivo | Línea del `[q, setQ]` a prefillear |
|---|---|---|
| Ventas | `app/(app)/ventas/ventas-client.tsx` | `155` |
| Reparaciones | `app/(app)/reparaciones/reparaciones-client.tsx` | `215` |
| Inventario (Equipos) | `app/(app)/inventario/inventario-client.tsx` | `212` (hay un solo `q` compartido por las 3 tabs — confirmar al implementar que filtra la tab activa; `tab` ya es state propio, default `"equipos"`, aceptar `?tab=` también si no lo lee ya) |
| Cajas | `app/(app)/cajas/cajas-client.tsx` | `98` (confirmar al implementar que ese `q` filtra `movimientos_caja.concepto` y no otra cosa — no se verificó a fondo en este plan) |

Cambio por archivo: `useState("")` → `useState(searchParams.get("q") ?? "")`
— los 4 archivos ya importan/usan `useSearchParams()` (confirmado por
grep), así que es agregar una línea, no una importación nueva.

## Qué NO construir en este alcance

- **No** abrir el detalle (dialog de venta/ticket/equipo) directo desde el
  resultado de búsqueda — eso requeriría portar el patrón `openId` (que
  `clientes`/`compras` ya tienen) a `ventas-client.tsx`/
  `reparaciones-client.tsx`/`inventario-client.tsx`, archivos grandes y
  con más de un dialog — se linkea a la lista filtrada por `?q=`, que ya
  resuelve "encontrar la fila" sin tocar lógica de dialogs. Portar el
  patrón `?open=` a esas 3 secciones queda como mejora futura, no entra
  acá.
- Un tercer trigger de apertura (ya hay atajo + botón flotante).
- Buscar dentro de Configuración/tabs (no hay dato real detrás, son
  secciones estáticas — ya cubierto por la búsqueda de nav).

## Verificación

1. `npx tsc --noEmit` y `npx vitest run` (agregar test de la nueva función
   pura `filterNavItems` en `lib/command-palette.test.ts`, mismo archivo
   que ya tiene tests de `filterQuickActions`).
2. `npm run dev`, abrir Cmd+K: confirmar que "Ir a" devuelve secciones de
   `lib/nav.ts` filtradas por rol, que las acciones rápidas siguen
   funcionando igual que antes, y que escribir 2+ caracteres de un cliente/
   venta/ticket/equipo/movimiento real trae resultados agrupados por tipo.
3. Click en un resultado de Ventas/Reparaciones/Inventario/Cajas → confirmar
   que navega a la sección con el filtro `?q=` ya aplicado en la tabla.
   Click en un resultado de Clientes → confirma que abre la ficha directo
   (`?open=`, ya existía).
4. Revisar visualmente el efecto "liquid glass" sobre al menos dos fondos
   distintos de la app (una pantalla con tabla densa detrás, y el dashboard
   con gráficos de color) — confirmar que el texto de los resultados sigue
   siendo legible con el blur aplicado.
