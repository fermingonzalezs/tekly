# 004 — 20 ilustraciones fieles de secciones reales para la landing

- **Status**: TODO
- **Scope**: solo producir y publicar ilustraciones estáticas (HTML/CSS)
  de 20 pantallas/vistas reales del sistema, en artifacts, para que el
  usuario las revise. **No incluye** todavía integrarlas al código de
  `components/marketing/*` — eso es un plan aparte, posterior a la
  revisión.
- **Category**: research + mockup visual (no toca código de producción)

## Contexto

Se viene armando, a mano y a los tropezones, una serie de ilustraciones
"fieles" (no inventadas) de distintas secciones del sistema para usarlas
en la landing (hero, showcase, features). El primer intento (Turnos) fue
inventado de memoria y el usuario lo rechazó explícitamente: *"¿no podés
ir a ver el código y hacer una ilustración animada en base a eso?"*. A
partir de ahí se estableció una metodología que **sí** funcionó (ya hay 4
ilustraciones aprobadas con este método: Turnos, Cajas, Ventas,
Difusión) y que este plan formaliza para escalarla a 20 vistas de todo
el sistema.

Las 4 ya hechas viven en dos artifacts de esta sesión (no versionados en
el repo — son artifacts de claude.ai, no archivos del proyecto):
- Turnos (+ notificaciones reales del `Toaster`) en el artifact "Hero
  Vidrio".
- Cajas, Ventas, Difusión en el artifact "Ilustraciones de Secciones".

Quien ejecute este plan **no tiene memoria de esas sesiones** — tiene que
redescubrir la metodología leyendo este documento y el código real, no
asumir que existe contexto previo.

## Metodología (la parte que no se puede saltear)

Por cada una de las 20 vistas, en este orden:

1. **Leer el código real primero.** `app/(app)/<seccion>/page.tsx` +
   `<seccion>-client.tsx` (o el componente específico si la vista es un
   tab/dialog particular). Buscar las partes de **layout/presentación**
   (JSX de StatCards, toolbar, tabla, badges) — no hace falta leer la
   lógica de formularios/validación/server actions si la vista a ilustrar
   no es justamente un formulario. Si el archivo es muy largo (>800
   líneas), usar un agente Explore para extraer solo la parte visual en
   vez de leer todo el archivo en el hilo principal — así se puede
   paralelizar 3-4 vistas a la vez sin que cada una se coma el contexto
   de una lectura completa. Copiar las clases Tailwind **literales**, no
   parafrasear de memoria.
2. **Revisar `lib/status.ts`** para cualquier tono/color/label real que
   use la vista (`dotClass`, `toneClass`, los `Record&lt;Tipo, {label,
   tone}&gt;` como `medioPago`, `turnoTipo`, `equipoStatus`, `otroCategoria`,
   etc.) — los colores de los puntos/badges salen de ahí, nunca
   inventados.
3. **Dos reglas globales de `app/globals.css` que aplican a TODA tabla,
   lo diga o no el componente**:
   - `th { background: var(--chart-1); color: #fff; font-weight:700;
     text-transform:uppercase; letter-spacing:.03em; }` — sin `@layer`,
     le gana a cualquier clase Tailwind que el componente le ponga al
     `&lt;th&gt;` (ej. `text-xs text-neutral-400`). Resultado real en
     pantalla: **toda** tabla tiene la banda índigo oscura + texto blanco
     mayúscula, aunque el código fuente del componente sugiera un header
     "flat"/gris. Ya pasó con Cajas y Ventas — sus `&lt;th&gt;` llevan clases
     de texto gris en el código pero se ven con la banda oscura igual.
   - `@layer base { tbody tr:nth-child(even) { background-image:
     repeating-linear-gradient(45deg, rgba(0,0,0,.012) 0 4px,
     rgba(0,0,0,0) 4px 8px); } }` — cebra sutil por defecto en toda tabla,
     salvo que el componente la pise con un `backgroundImage` inline más
     fuerte (Turnos lo hace, con 0.025 de opacidad en vez de 0.012 —
     mirar si la vista puntual tiene ese override antes de asumir el
     default).
4. **Contenido real, no inventado**: en este orden de preferencia —
   (a) datos de una captura de pantalla real que el usuario ya compartió
   en esta conversación o en el repo, (b) seed/mock real
   (`lib/mock-data.ts`), (c) si no hay ninguna de las dos, recién ahí
   completar con contenido plausible **marcado explícitamente como tal**
   (ej. "agregada" al lado de una fila de relleno, o una nota aparte
   diciendo qué número es estimado y por qué). Nunca presentar un dato
   inventado como si fuera real sin aviso — eso fue exactamente el primer
   error con Turnos.
5. **No agregar elementos de UI que no existen.** Si CLAUDE.md o la
   intuición sugieren algo (ej. "preview estilo WhatsApp" en Difusión)
   pero el código real no lo tiene, **no dibujarlo** — avisar
   explícitamente "esto no existe en el código real" en vez de
   inventarlo para que quede más lindo.
6. **Construir la ilustración** como HTML/CSS (+ JS vanilla mínimo solo
   para la entrada escalonada tipo fade/scale-in, con
   `@media (prefers-reduced-motion: reduce)` desactivando la animación
   por completo) dentro del mismo marco "ventana completa" ya acordado
   (ajustado una vuelta: al principio se había probado sin la barra de
   puntitos, pero el usuario pidió explícitamente volver a esta versión,
   mostrando como referencia el `MockupDashboard` real de la landing):
   ```css
   .frame {
     border-radius: 18px;
     overflow: hidden;
     border: 1px solid var(--border); /* #e5e5e5 */
     box-shadow: 0 40px 80px -30px rgba(23, 23, 23, 0.25);
     background: #fff;
   }
   ```
   Adentro del `.frame`, **siempre** arriba de todo (en este orden):
   1. **`.winbar`**: barra tipo navegador — 3 puntitos grises (`bg:
      #e5e5e5`) + una "pill" chica a la derecha simulando una barra de
      direcciones (`bg: #f0f0f0`), fondo `#fafafa`, igual que la barra
      superior real de `components/marketing/ui/mockup-dashboard.tsx`.
   2. **`.appnav`**: el topnav decorativo real de ese mismo componente —
      logo (`T` en cuadrado accent + "Tekly" en Bricolage Grotesque) +
      **los mismos 5 ítems fijos, siempre en este orden**: `Dashboard,
      Ventas, Reparaciones, Inventario, Turnos` (es el array
      `NAV_ITEMS` literal del componente real — no inventar otros ni
      agregar más). Si la sección que se está ilustrando coincide con
      uno de esos 5 nombres, marcarlo `active` (`bg-accent-soft
      text-accent`); si no coincide (Cajas, Compras, Cuentas corrientes,
      Difusión, Analíticas, Configuración, Clientes), **dejar los 5 sin
      marcar** — no forzar un match que no existe en esa lista.
   3. Recién después, el contenido real de la sección (StatCards, tabs,
      tabla, etc.).

   Si la ilustración necesita tarjetas flotantes de notificación (como
   Turnos, que usa las dos reales del `Toaster` — ver más abajo),
   **tienen que sangrar fuera del marco** (offsets negativos, ej. `top:
   -34px; right: -22px`), no quedar contenidas prolijamente adentro —
   así es como se ven en el Hero real (`hero.tsx`, las `FadeIn` con
   `-right-3 -top-6` etc.), y es literalmente lo que pidió el usuario
   mostrando la captura de referencia.

   Reusar la misma paleta de tokens que ya vienen usando las 4
   ilustraciones previas (ver abajo).
7. Cada ilustración lleva una **caption corta arriba** (fuera del marco)
   que diga: qué archivo(s) se consultó, qué dato es real vs. estimado/
   agregado, y cualquier hallazgo de regla global relevante para esa
   vista en particular (igual que se hizo con Cajas/Ventas/Difusión).

### Paleta/tokens compartidos (copiar tal cual, no reinventar por ilustración)

```css
--bg: #fafafa;
--text: #171717;
--text-secondary: #5f5f66;
--accent: #4f49bd;
--accent-soft: #edecf8;
--border: #e5e5e5;
--header: #352f86;         /* banda de th, var(--chart-1) real */
```
Tipografía: `Bricolage Grotesque` (Google Fonts, `<link>`, pesos
600/700/800) para títulos/headers de las ilustraciones — es la misma
fuente que ya se decidió para los headlines de la landing (ver plan 002).
Texto de cuerpo: `ui-sans-serif, system-ui, ...` (sin fuente custom).

Colores de dot reales (de `lib/status.ts`, no aproximar):
`blue=#3b82f6, amber=#f59e0b, green=#10b981, gray=#a3a3a3, red=#ef4444,
violet=#8b5cf6`.

## Las 20 vistas a ilustrar

Ya hechas (4) — **reusar tal cual, no rehacer**:

| # | Vista | Dónde vive hoy |
|---|---|---|
| 1 | Turnos (calendario semanal + 2 notificaciones del `Toaster` real) | Artifact "Hero Vidrio" |
| 2 | Cajas (Movimientos + panel "Por medio de pago") | Artifact "Ilustraciones de Secciones" |
| 3 | Ventas (tabla principal, pago dividido incluido) | Artifact "Ilustraciones de Secciones" |
| 4 | Difusión (listado de listas) | Artifact "Ilustraciones de Secciones" |

Pendientes (16), una por archivo/vista real:

| # | Vista | Archivo(s) principal(es) a leer |
|---|---|---|
| 5 | Dashboard (overview: StatCards + TrendChart + donut rubros) | `app/(app)/dashboard/page.tsx`, `dashboard-client.tsx`, `components/dashboard/*` |
| 6 | Clientes (tabla + ficha resumen al abrir una fila) | `app/(app)/clientes/page.tsx`, `clientes-client.tsx` |
| 7 | Inventario — tab Equipos | `app/(app)/inventario/inventario-client.tsx` |
| 8 | Inventario — tab Repuestos (con Recuento/Ingreso) | ídem |
| 9 | Inventario — tab Otros | ídem |
| 10 | Reparaciones — Tickets (pipeline + tabla) | `app/(app)/reparaciones/reparaciones-client.tsx` |
| 11 | Reparaciones — Servicios (catálogo) | `components/servicios-catalogo.tsx` |
| 12 | Ventas — tab "Ítems vendidos" | `app/(app)/ventas/ventas-client.tsx` (ya se leyó para #3 — reusar notas) |
| 13 | Cajas — tab Conciliaciones | `app/(app)/cajas/cajas-client.tsx` (ya se leyó para #2 — reusar notas) |
| 14 | Compras | `app/(app)/compras/compras-client.tsx` |
| 15 | Cuentas corrientes | `app/(app)/cuentas-corrientes/cuentas-corrientes-client.tsx`, `lib/cuentas-corrientes.ts` |
| 16 | Analíticas — overview (facturación por vendedor, ventas por rubro) | `app/(app)/analiticas/analiticas-client.tsx`, `lib/analiticas.ts` |
| 17 | Analíticas — tab Clientes (mapa de valor / cohortes) | `components/analiticas/clientes/*` |
| 18 | Configuración — Usuarios y roles | `app/(app)/configuracion/configuracion-client.tsx` |
| 19 | Dialog "Nueva venta" (pago dividido, referencia de form completo según CLAUDE.md) | `app/(app)/ventas/ventas-client.tsx` (el modal, no la tabla) |
| 20 | Detalle de ticket (checklist + presupuesto) | `app/(app)/reparaciones/reparaciones-client.tsx` (el dialog de detalle) |

Nota: #19 y #20 son dialogs, no páginas completas — para esos dos la
ilustración muestra el dialog flotando (centrado, con su propia sombra),
no la página de fondo.

## Organización del trabajo

- Agrupar las 16 pendientes en tandas de 3-4 y lanzar un agente Explore
  por vista (o por archivo si dos vistas comparten componente, como
  Ventas #3/#12 y Cajas #2/#13) **en paralelo dentro de cada tanda**, con
  el mismo tipo de prompt que ya funcionó: pedir clases Tailwind
  literales, tonos reales, datos de ejemplo reales si existen, sin que el
  agente escriba código — solo que reporte.
- Con el reporte de cada tanda, construir las ilustraciones (HTML/CSS)
  directamente, reusando los bloques CSS compartidos (`.frame`, `.chip`,
  `.tbl`, `.statrow`, etc. — ya existen en el artifact "Ilustraciones de
  Secciones", partir de ahí en vez de reinventar el CSS por cada vista
  nueva).
- Publicar todo en uno o varios artifacts "galería" (agrupar por
  dominio tiene sentido: ej. un artifact para Dashboard+Clientes+
  Analíticas, otro para Inventario+Reparaciones+Compras+Cuentas
  corrientes, y actualizar el artifact ya existente de Cajas/Ventas/
  Difusión con Conciliaciones/Ítems vendidos/Nueva venta) — no hace falta
  que las 20 estén en una sola página gigante, pero sí agrupadas de forma
  que el usuario pueda revisarlas de a bloques manejables.

## Qué NO hacer en este plan

- No tocar ningún archivo de `components/marketing/*` ni de
  `app/marketing/*` — esto es solo producción de mockups en artifacts
  para revisión. Integrarlas a la landing real es un plan posterior,
  una vez que el usuario apruebe cuáles le gustan.
- No inventar métricas/microcopy que no salgan de código real o de una
  captura ya compartida — ante la duda, marcar como estimado en vez de
  improvisar en silencio.
- No agregar elementos de UI "porque quedarían lindos" si no existen en
  el componente real (ver Difusión: no hay burbuja de WhatsApp, no se
  dibujó una).

## Verificación

1. Cada ilustración nueva, antes de darla por terminada, se compara
   mentalmente contra el código fuente leído: ¿el header de la tabla es
   la banda índigo? ¿los colores de los dots coinciden con `lib/status.ts`?
   ¿el dato mostrado es real, de seed, o marcado como estimado?
2. El usuario revisa las 20 de punta a punta y devuelve, por cada una:
   aprobada tal cual / ajustar algo puntual / descartar.
3. Recién ahí (fuera de este plan) se decide cuáles de las 20 pasan a
   `components/marketing/*` de verdad.
