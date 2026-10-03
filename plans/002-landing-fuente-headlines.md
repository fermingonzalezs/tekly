# 002 — Cambiar la fuente de headlines de la landing (solo tekly.tech)

- **Status**: TODO
- **Scope**: solo `app/marketing/*` y `components/marketing/*` — tipografía
  de titulares. Sin tocar el dashboard interno de gestión ni ningún otro
  aspecto visual de la landing (motion, color, layout).
- **Category**: mejora visual / tipografía

## Contexto

El usuario pidió analizar la landing para mejorarla, pero acotó el alcance
explícitamente: *"la fuente no me convence, no hay nada más que me importe
cambiar"*. Hoy toda la landing (`components/marketing/*`) y los números
hero del dashboard interno de gestión (`StatCard`, `MetricCards`) comparten
**la misma fuente global**, `Space Grotesk`, cargada una sola vez en
`app/layout.tsx` (root layout) y expuesta vía la utilidad Tailwind
`font-grotesk`.

Decisiones ya tomadas con el usuario (no reabrir sin confirmar con él):

- **Alcance confirmado**: cambiar la fuente **solo en la landing**. El
  dashboard interno queda intacto — es un sistema de diseño ya establecido
  y documentado en `CLAUDE.md`, sin pedido de tocarlo.
- **Elección de fuente**: delegada a quien planeó esto. Se eligió
  `Bricolage Grotesque` (ver justificación abajo); si al ejecutar este plan
  se prefiere otra, el mecanismo de carga/scoping es el mismo — solo cambia
  el nombre de la fuente importada de `next/font/google`.
- **Nada más se toca**: motion, color, layout y el resto de la landing
  quedan exactamente igual.

### Por qué `Bricolage Grotesque`

Disponible en Google Fonts, soportada por `next/font/google` (verificado en
`node_modules/next/dist/compiled/@next/font/dist/google/font-data.json`),
variable font con pesos estáticos 400/500/600/700 — mismo rango que se usa
hoy, sin instalar ningún paquete nuevo. Tiene terminales redondeadas y
detalles propios que se notan en los headlines grandes en mayúscula de la
landing (`uppercase tracking-tight text-5xl/6xl/7xl`, patrón repetido en
todas las secciones), diferenciándose de Space Grotesk y evitando el cliché
de geométricas "neutras" (Inter/Outfit/Sora) que son hoy el default más
visto en SaaS genérico.

## Mecanismo: nueva fuente scopeada solo a la landing

Las custom properties de CSS cascadean por el DOM: si se define una
variable con el mismo rol que `--font-space-grotesk` pero en un nodo
descendiente, ese subárbol la hereda sin afectar al resto del documento. En
vez de reusar el nombre `--font-space-grotesk` (confundiría — ese nombre ya
tiene un comentario en `app/layout.tsx` diciendo que es Space Grotesk), se
usa una variable y una utilidad Tailwind con nombre propio:
`--font-marketing-display` / `font-display`.

- **No se toca** `app/layout.tsx` ni nada bajo `app/(app)/*` — el dashboard
  interno sigue en Space Grotesk exactamente igual.
- **Se agrega** la carga de `Bricolage_Grotesque` en
  `app/marketing/layout.tsx`, aplicada como `className` en el único `div`
  wrapper de ese layout (todo lo que renderiza `app/marketing/page.tsx`
  cuelga de ahí).
- **Se agrega** una entrada `display` a `theme.extend.fontFamily` en
  `tailwind.config.ts`, mismo patrón que la entrada `grotesk` existente.
- **Se reemplaza** la clase `font-grotesk` → `font-display` en los
  headlines reales de marca de `components/marketing/*` (h1/h2/h3, número
  de paso, precio, wordmark del logo) — **excepto**
  `components/marketing/ui/mockup-dashboard.tsx`, que es una recreación
  visual del dashboard real dentro de la landing y debe seguir pareciéndose
  a él (queda en `font-grotesk`/Space Grotesk a propósito).

## ⚠️ No pisar trabajo en curso

Al momento de escribir este plan hay cambios sin commitear en `hero.tsx`,
`cta-final.tsx` y `ui/marketing-button.tsx`: un rediseño del botón CTA (pill
+ "chip" circular de flecha que se desliza al hover, reemplazando el
`<ArrowRight>` que antes pasaba cada caller). Antes de ejecutar este plan,
confirmar el estado de `git status`/`git diff` sobre esos 3 archivos — si
ese trabajo sigue en curso, **no tocar `marketing-button.tsx`** y, en
`hero.tsx`/`cta-final.tsx`, limitarse a cambiar la clase `font-grotesk` del
`<h1>`/`<h2>` por `font-display` sin revertir ni modificar el resto del
diff en curso de esos dos archivos.

## Archivos a modificar

### `app/marketing/layout.tsx`
Agregar la carga de la fuente y aplicar su `.variable` al div wrapper:
```tsx
import { Bricolage_Grotesque } from "next/font/google";

const marketingDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-marketing-display",
  display: "swap",
});
```
y en el `return`:
```tsx
<div
  data-tema="violeta"
  className={`min-h-screen bg-neutral-50 ${marketingDisplay.variable}`}
>
```

### `tailwind.config.ts`
Agregar junto a `grotesk` (dentro de `theme.extend.fontFamily`):
```ts
display: [
  "var(--font-marketing-display)",
  "ui-sans-serif",
  "system-ui",
  "sans-serif",
],
```

### Reemplazar `font-grotesk` → `font-display` (solo estas líneas)
- `components/marketing/hero.tsx:106` — `<h1>`
- `components/marketing/nav.tsx:40,43` — logo "T" + wordmark "Tekly"
- `components/marketing/features.tsx:56,79` — `<h2>`, `<h3>`
- `components/marketing/how-it-works.tsx:48,64,67` — `<h2>`, número de
  paso (círculo "01/02/03"), `<h3>`
- `components/marketing/showcase.tsx:56` — `<h2>`
- `components/marketing/pricing.tsx:76,84` — nombre de plan, precio
- `components/marketing/cta-final.tsx:42` — `<h2>`
- `components/marketing/footer.tsx:18,21` — logo "T" + wordmark "Tekly"

(Números de línea tomados al momento de escribir este plan — si el archivo
cambió entretanto, ubicar por el texto de la clase citado, no asumir que el
número de línea sigue exacto.)

## Qué NO construir en este alcance

- No tocar `app/layout.tsx` ni `app/globals.css` (el `body { font-family }`
  del texto normal sigue igual).
- No tocar `components/marketing/ui/mockup-dashboard.tsx` (queda en
  `font-grotesk` a propósito, para seguir pareciéndose al dashboard real).
- No tocar `components/marketing/ui/marketing-button.tsx` ni revertir el
  trabajo en curso del botón CTA.
- No tocar nada bajo `app/(app)/*`, `components/ui/stat-card.tsx`,
  `components/dashboard/*` ni ningún otro componente del dashboard interno.
- No cambiar motion, color, layout ni ningún otro aspecto de la landing —
  el pedido del usuario fue puntual a tipografía.

## Verificación

1. `npx tsc --noEmit` — sin errores de tipos tras el import nuevo.
2. `npm run dev`, abrir la landing (`http://localhost:3100/`, o forzar el
   host `tekly.localhost:3100` si la middleware lo requiere) y confirmar
   visualmente que los headlines cambiaron de Space Grotesk a Bricolage
   Grotesque — especialmente notorio en el `<h1>` del hero (uppercase,
   tamaño grande).
3. Inspeccionar en devtools el `computed style` de `font-family` del `<h1>`
   del hero (debe listar la fuente nueva) y, dentro del mismo hero, el
   `MockupDashboard` (debe seguir en Space Grotesk) — confirma que el
   scoping por utilidad funciona dentro de la misma página.
4. Confirmar que no se agregó ningún request a `fonts.googleapis.com` en
   runtime (next/font self-hostea el `.woff2`, igual que ya pasa con Space
   Grotesk).
5. Si hay forma de loguearse, comparar un `StatCard` del dashboard interno
   antes/después — debe ser pixel-idéntico (no se tocó `app/layout.tsx`).
