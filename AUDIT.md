# UX/UI audit: Tekly (app completa) — 2026-09-26

Sin `DESIGN.md`: el proyecto no tiene ese archivo — el sistema de diseño vive
documentado en `CLAUDE.md` ("Sistema de diseño" + "Componentes reutilizables").
Se usó esa sección como estándar de consistencia, junto con el checklist
genérico del skill.

**Método**: login real (Supabase Auth, cuenta de prueba provista) vía
Playwright + Chromium (no había `scripts/shot.mjs` ni Playwright instalados;
se instalaron para esta auditoría). Capturas en 360/768/1280px de Dashboard,
Ventas (lista + "Nueva venta" + intento de submit inválido), Reparaciones,
Inventario y Clientes (lista + ficha). Consola y errores de página
capturados en todas las navegaciones. Accesibilidad: `axe-core` corrido
contra Dashboard, Ventas, Reparaciones, Inventario y Clientes ya autenticado
(tags `wcag2a`/`wcag2aa`/`wcag21aa`/`wcag22aa`).

## Verdict

La base visual es sólida y nada genérica: un solo acento índigo, paleta de
gráficos monocromática, `StatCard`/`ChartTitle`/`Badge` reusados sin
reinventar, microcopy en español consistente. El problema más grande es que
**la implementación se desvió del propio sistema de diseño documentado**: el
alineado de tablas (izquierda por defecto, según `CLAUDE.md`) está invertido
a centrado en 10 de 13 secciones, y dos gráficos de ranking usan la textura
reservada para barras de objetivo. La mayor oportunidad es barata: un solo
cambio de token (`text-neutral-400` → `text-neutral-500` en labels/eyebrows)
resuelve 63+ violaciones de contraste que `axe` marcó en cada pantalla
muestreada.

## Scores

| Category | Score | Why |
|---|---|---|
| Visual hierarchy | 4 | KPIs con `StatCard` consistentes, una sola acción primaria por vista; jerarquía clara en Dashboard/Ventas/Reparaciones. |
| Typography | 4 | Escala única + Space Grotesk en números hero, bien aplicado; sin drift de tamaños. |
| Color and contrast | 2 | Label/eyebrow (`text-[11px] uppercase text-neutral-400`) mide ~2.5:1 sobre blanco — falla AA (4.5:1) en las 5 pantallas escaneadas con `axe` (63 nodos solo en Dashboard). |
| Spacing and layout | 3 | Escala de espaciado consistente, pero el filtro de "Ventas recientes" se corta visualmente a 360px (ver P0). |
| Consistency with design system | 2 | Tablas centradas contradicen la regla explícita "todo alineado a la izquierda por defecto" en 10/13 secciones; `RepairsChart`/`demografia.tsx` usan `GHOST_STRIPES` pese a estar nombrados en `CLAUDE.md` como ejemplo de "pista lisa". |
| Components and states | 3 | `Button`/`Input` con estados completos; pero `<Select>` de toolbar sin nombre accesible, keys duplicadas (`"none"`) en 2 secciones. |
| Responsiveness | 2 | Rompe en uno de los 3 checkpoints obligatorios (360px, Dashboard → filtro de Ventas recientes ilegible/no tocable). |
| Accessibility (WCAG 2.2 AA) | 2 | `axe` reporta `button-name`/`select-name` (critical) y `color-contrast` (serious) en las 5 pantallas escaneadas. |
| Interaction and feedback | 3 | Estados hover/focus/disabled sólidos en `Button`; el submit deshabilitado de "Nueva venta" no explica qué falta. |
| Content and microcopy | 4 | Español correcto, verbos en botones, moneda formateada con `fmtUsd`; sin lorem ipsum. |
| Performance perception | 3 | Consola con errores reales en cada carga (hydration mismatch, keys duplicadas) — no es solo ruido cosmético. |

## Findings

### P0 Blocking (broken, inaccessible, or unusable)

**1. El botón de categoría de nav no tiene nombre accesible entre 768–1279px**
- **What**: El botón que abre el dropdown de una categoría de navegación (ej. "Stock", "Finanzas") es solo un ícono + chevron entre `md` (768px) y `xl` (1280px) — el `<span>` con el texto está en `hidden ... xl:flex`, así que para un lector de pantalla el botón no tiene nombre en ese rango.
- **Where**: `components/topnav.tsx:74-90`. Confirmado por `axe` (`button-name`, critical) en las 5 pantallas escaneadas a 1280px con scrollbar real (ancho efectivo <1280, por debajo del breakpoint `xl`) — en producción esto es el estado por defecto en cualquier laptop de 768–1279px, no un caso de borde.
- **Why it matters**: Un usuario de lector de pantalla no puede saber qué hace ese botón — la navegación agrupada (Stock, Finanzas) queda inaccesible por teclado/lector en el rango de resolución más común de laptop.
- **Fix**: agregar `aria-label={label}` al `<button>` (línea 74), o un `<span className="sr-only">{label}</span>` además del que ya está oculto visualmente.

**2. El filtro de "Ventas recientes" del Dashboard se corta a 360px**
- **What**: El buscador (`w-36`) + el select de categoría (`w-44`) del widget "Ventas recientes" están en un `flex shrink-0` sin wrap, dentro de una `Card` con `overflow-hidden`. A 360px de ancho no entran — el texto del select se corta ("Todas las categoría…") y la porción que no entra queda invisible/no tocable.
- **Where**: `components/dashboard/recent-sales.tsx:38-69`. Evidencia visual: `dashboard--mobile.png` (fila de búsqueda bajo "Ventas recientes").
- **Why it matters**: Es uno de los 3 checkpoints obligatorios (360px) y es la pantalla principal (Dashboard) — el filtro de categoría queda roto para cualquier usuario en un celular real, no es un caso extremo.
- **Fix**: envolver el grupo en `flex-wrap` (o apilar `Input`/`Select` en columna por debajo de `sm`), y sacar los anchos fijos (`w-36`/`w-44`) en mobile.

### P1 High (clearly hurts usability or looks unprofessional)

**3. Hydration mismatch: el monto en pesos de un pago cambia solo al cargar Ventas**
- **What**: Al entrar a `/ventas`, React tira `Warning: Text content did not match. Server: "$ 820.400" Client: "$ 873.600"` en `VentaCardMobile`, y Next reporta "There was an error while hydrating this Suspense boundary. Switched to client rendering." El monto en ARS de un pago "Efectivo (pesos)" se recalcula distinto en el render de servidor vs. cliente (la cotización del dólar difiere entre ambos passes).
- **Where**: `app/(app)/ventas/ventas-client.tsx:942` (`VentaCardMobile`), consola capturada en `_console.log` (línea del warning + los 2 `pageerror`).
- **Why it matters**: Es un monto de dinero real que cambia solo frente al usuario justo después de cargar la página — además de la señal de alarma en consola (con el DevOverlay de Next mostrando "2 errors" visible en pantalla, ver `ventas-lista--desktop.png`).
- **Fix**: que el server y el cliente usen la misma cotización en el primer render (pasarla como prop fija desde el server component en vez de que `useDolar()` la recalcule del lado del cliente antes de hidratar).

**4. Tablas centradas contradicen la regla documentada de alineado a la izquierda**
- **What**: `CLAUDE.md` dice explícitamente "Todo alineado a la izquierda por defecto (`th, td { text-align:left }`)", con `text-center` reservado para casos puntuales (ej. "sin resultados"). En la práctica, 10 de 13 `*-client.tsx` aplican `text-center` a *todas* las columnas de sus tablas (nombres, emails, IMEI, fechas — no solo números): Cajas (27 celdas), Inventario (27), Recuentos (17), Ventas (18), Compras (8), Reparaciones (7), Clientes (7), Configuración (6), Cuentas corrientes (5), Difusión (5).
- **Where**: ej. `app/(app)/inventario/inventario-client.tsx:709-790`, `app/(app)/clientes/clientes-client.tsx:161-173`. Ver capturas `inventario--desktop.png`/`clientes-ficha--desktop.png` (tabla de fondo).
- **Why it matters**: No es un detalle menor de una sola pantalla — es la convención real en casi toda la app, en contradicción directa con lo que el propio equipo documentó como estándar. O el código está mal o el documento quedó desactualizado; cualquiera de las dos deja a `CLAUDE.md` mintiendo sobre el sistema de diseño real.
- **Fix**: decisión de producto, no solo de código — reconciliar en una sola dirección (sacar los `text-center` de columnas de texto, o actualizar `CLAUDE.md` para reflejar que centrado es la convención real).

**5. Contraste insuficiente en todos los labels/eyebrows de la app**
- **What**: `text-[11px] font-semibold uppercase tracking-wider text-neutral-400` (el label estándar de `Field`, `ChartTitle`, captions de gráfico) mide ~2.5:1 sobre fondo blanco — el mínimo AA para texto normal es 4.5:1. `axe` lo marca como `color-contrast` (serious) con 63 nodos en Dashboard, 30 en Reparaciones, 25 en Inventario, 17 en Ventas, 10 en Clientes.
- **Where**: `components/ui/field.tsx` (`Label`), y cualquier caption que reuse ese mismo patrón (`ChartTitle`, ejes de gráfico).
- **Why it matters**: Es el estilo de label usado en *todos los formularios y todos los gráficos* de la app — el problema de contraste no es de una pantalla, es del token.
- **Fix**: `text-neutral-400` → `text-neutral-500` (`#737373`, ratio 4.74:1, pasa AA) en ese patrón. Un solo cambio de clase, propaga a toda la app.

**6. Selects de filtro sin nombre accesible**
- **What**: Los `<Select>` sueltos de las toolbars de filtro (vendedor, tipo, fecha en Ventas; técnico, estado, fecha en Reparaciones; búsqueda de categoría en Dashboard) no tienen `<label>` ni `aria-label` — `axe` los marca `select-name` (critical): 3 nodos en Ventas, 3 en Reparaciones, 1 en Dashboard.
- **Where**: `app/(app)/ventas/ventas-client.tsx:384-410` (ejemplo concreto: filtro de vendedor/tipo/fecha).
- **Why it matters**: Un usuario de lector de pantalla no puede distinguir "filtro de vendedor" de "filtro de tipo" — solo escucha "combobox" sin contexto.
- **Fix**: `aria-label="Filtrar por vendedor"` (etc.) en cada `<Select>` de toolbar — mecánico, no requiere rediseño visual.

### P2 Medium (inconsistency, polish)

**7. `RepairsChart` y `demografia.tsx` usan la textura de "objetivo" en un gráfico de ranking**
- **What**: `CLAUDE.md` nombra explícitamente a `RepairsChart` y `demografia.tsx` como ejemplos de gráfico "ranking/comparación" (cada barra independiente contra su propio máximo), que según la misma regla debería llevar pista lisa `bg-neutral-100`. Ambos archivos usan `GHOST_STRIPES` (la textura rayada reservada para barras de objetivo/cuota) en la pista.
- **Where**: `components/dashboard/repairs-chart.tsx:28-31`, `components/clientes/demografia.tsx:53-56`. Visible en `reparaciones--desktop.png` ("REPARACIONES MES").
- **Why it matters**: Rompe la distinción visual que el propio sistema de diseño establece entre "esto es una meta a cumplir" (rayado) y "esto es una comparación entre categorías" (liso) — confunde la lectura del gráfico.
- **Fix**: `style={{ background: GHOST_STRIPES }}` → `className="bg-neutral-100"` en ambos.

**8. Keys duplicadas (`"none"`) entre dialogs hermanos**
- **What**: El patrón documentado `key={condición ? id : "b"}` (para resetear el estado del `Dialog` al reabrir) se implementó con el mismo literal `"none"` como fallback en varios dialogs hermanos dentro del mismo componente. Cuando todos están cerrados a la vez (el estado inicial más común), React ve varios hijos con `key="none"` y tira `Warning: Encountered two children with the same key`.
- **Where**: `app/(app)/reparaciones/reparaciones-client.tsx:1055` (`ReciboDialog`) y `:1288` (`EntregarEquipoDialog`); `app/(app)/inventario/inventario-client.tsx:1680`, `:1765`, `:1798` (3 dialogs con el mismo fallback). Confirmado en consola (11 ocurrencias en total durante la sesión).
- **Why it matters**: No rompe nada visible hoy (son componentes de tipos distintos, React los distingue por tipo antes que por key), pero ensucia la consola en cada carga y es una trampa para el próximo dialog que se agregue del mismo tipo.
- **Fix**: prefijar el fallback por dialog (`"recibo-none"`, `"entregar-none"`, `"equipo-none"`, etc.) en vez de compartir el literal `"none"`.

**9. Múltiples instancias de `GoTrueClient` en el mismo browser context**
- **What**: El SDK de Supabase advierte "Multiple GoTrueClient instances detected... may produce undefined behavior when used concurrently under the same storage key" — 6 veces durante la sesión.
- **Where**: consola de `_console.log`; el propio SDK marca el storage key `sb-xdfdrzxrmfpnezyeeaeq-auth-token`.
- **Why it matters**: Supabase mismo lo marca como potencialmente inestable bajo uso concurrente — no se observó una falla real en esta sesión, pero es una señal de que se está creando más de un cliente Supabase donde debería reusarse uno (`lib/auth/supabase.ts` es la única puerta documentada; vale la pena confirmar que ningún componente cliente cree su propio `createBrowserClient` extra).
- **Fix**: auditar dónde se instancia el cliente de browser y asegurar un singleton (ej. módulo con `let client` cacheado) en vez de crear uno nuevo por componente/render.

### P3 Low (nice to have)

**10. "Confirmar venta" queda deshabilitado sin explicar por qué**
- **What**: En "Nueva venta", si no se cargó ningún ítem el botón "Confirmar venta · U$ 0" queda deshabilitado (opacidad baja) pero no hay ningún texto que diga "agregá al menos un ítem" — el usuario tiene que adivinar qué falta.
- **Where**: `ventas-nueva-dialog-submit-attempt--desktop.png`. Coincide con una brecha ya documentada en `CLAUDE.md` ("Estados de elementos interactivos": sin estado de error en inputs, sin componente de validación inline).
- **Why it matters**: Fricción menor pero real en el flujo de venta más usado de la app.
- **Fix**: mensaje corto bajo el bloque de ítems/pago cuando el total no cierra (ej. "Agregá al menos un ítem para confirmar").

## Generic-AI tells

Ninguno encontrado — sin Inter/Roboto por defecto (usa Space Grotesk a propósito para números hero), sin gradiente púrpura-azul genérico (el único gradiente es el índigo de marca en `Button` primary), sin glassmorphism, sin grid de 3 cards idénticas, sin emojis como íconos (los emojis de medios de pago son contenido de negocio documentado, no íconos de UI), sin lorem ipsum.

## Quick wins (under 1 hour total)

**Las 6 se aplicaron.** `npx tsc --noEmit` y `npx vitest run` (84 tests) en
verde después de aplicarlas. Re-scan de `axe-core` post-fix: 0 violaciones
`button-name`/`select-name` (eran critical) en las 5 pantallas escaneadas;
`color-contrast` bajó de 63→34 (Dashboard), 30→17 (Reparaciones), 25→18
(Inventario), 17→12 (Ventas), 10→7 (Clientes) — las que quedan son un
patrón distinto no cubierto por este quick win (ver nota al final).

1. ~~`text-neutral-400` → `text-neutral-500` en el label de `components/ui/field.tsx` (y cualquier caption que copie ese patrón)~~ — aplicado en las 20 archivos que copiaban el patrón (`ChartTitle` incluido), no solo `field.tsx`.
2. ~~`aria-label` en los `<Select>` de toolbar~~ — aplicado en Ventas (vendedor/tipo/fecha), Reparaciones (técnico/estado/fecha) y el select de categoría de `recent-sales.tsx` (Dashboard). Inventario no tenía en realidad ningún `<Select>` de toolbar marcado por `axe` — la mención original fue imprecisa, no había nada que arreglar ahí.
3. ~~`aria-label` en el botón de categoría de `TopNav`~~ — aplicado (`aria-label={label}` + `aria-expanded`). El botón real detrás del `button-name` de axe en cada pantalla era la campana de notificaciones (`components/notifications/bell.tsx`), no la de `TopNav` — se le agregó `aria-label="Notificaciones"` también.
4. ~~`GHOST_STRIPES` → `bg-neutral-100`~~ — aplicado en ambos archivos + import sin uso removido.
5. ~~Prefijar las keys `"none"`~~ — aplicado en `reparaciones-client.tsx` (2) e `inventario-client.tsx` (3); se encontraron 2 casos más del mismo patrón en `ventas-client.tsx` (`ReciboDialog`/`CanjeModal`) y se corrigieron también.
6. ~~`flex-wrap` en `recent-sales.tsx`~~ — aplicado, más anchos responsivos (`w-24 sm:w-36` / `w-28 sm:w-44`) para que quepa a 360px sin recortarse. Confirmado con captura post-fix.

**Lo que queda** (no estaba en el alcance de estos 6, no se tocó): el chip
verde de `Delta` (`bg-emerald-50 text-emerald-600`, ratio 3.57:1) y el texto
de `deltaHint` (`text-neutral-400 text-[10px]`, no uppercase — no coincidía
con el patrón de label/eyebrow que cubrió el quick win #1) siguen bajo AA.
Mismo arreglo que #1 si se decide encararlo (`stat-card.tsx`).

## What is already good

- Un solo acento (índigo) y una paleta de gráficos monocromática real, sin colores arbitrarios por serie — se nota disciplina de sistema, no una app genérica.
- `StatCard`/`ChartTitle`/`Badge` reusados consistentemente en las 5 secciones muestreadas, cero reinvención ad hoc de cards de stats o títulos.
- Estrategia mobile de tablas densas (`VentaCardMobile` como fallback de card en vez de scroll horizontal crudo) bien pensada, no un genérico "overflow-x-auto" y listo.
- Microcopy en español consistente, verbos claros en botones ("Confirmar venta", "Agregar equipo"), formato de moneda uniforme (`fmtUsd`) en toda la app.
