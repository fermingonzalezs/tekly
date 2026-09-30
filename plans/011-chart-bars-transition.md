# 011 — Add transitions to chart bars that currently teleport to new values

- **Status**: DONE
- **Commit**: 5e82fe8
- **Severity**: LOW-MEDIUM (missed opportunity)
- **Category**: Missed opportunities / Performance
- **Estimated scope**: 8 files, 1 style/className change each

## Problem

Eight bar-chart elements across Dashboard and Analíticas set their fill from an inline `style={{ width: ... }}` or `style={{ height: ... }}` with **no transition at all**. Every time the underlying value changes — a period selector, a tab switch, a filter click — the bar's length jumps instantly instead of easing to its new value. AUDIT.md category 8 names this exact pattern: "State changes that teleport (content swaps, layout jumps) where a brief transition would prevent a jarring change."

The eight locations, already confirmed at commit `5e82fe8`:

1. `components/dashboard/repairs-chart.tsx:28-34` — horizontal pill, solid color fill, no child content.
2. `components/analiticas/funnel-reparaciones.tsx:52-55` — horizontal rounded-md fill, no child content.
3. `app/(app)/analiticas/analiticas-client.tsx:103-107` (the `BarRows` helper) — horizontal rounded-full fill, no child content.
4. `components/analiticas/flujo-caja.tsx:126-134` — two vertical bars (ingresos/egresos) anchored to the bottom via `items-end`, no child content.
5. `components/analiticas/inventario-flow.tsx:52-56` (the `Barra` helper) — single vertical bar anchored to the bottom via `items-end`, no child content.
6. `components/dashboard/objetivo-panel.tsx:56-68` — horizontal fill that **contains a text chip** (`{pct}%`) as a child.
7. `components/dashboard/reparaciones-split.tsx:28-40` — horizontal fill that is one of two flex segments (the second is `flex-1`, filling whatever the first *doesn't* take) **plus** a separate absolutely-positioned marker (`left: ${pct}%`) that must stay in sync with the same value.
8. `components/analiticas/tendencia-rubros.tsx:151-166` — a stacked multi-segment bar: the outer container's `height` sizes the whole stack, and inner segments divide that height proportionally via `flexGrow`.

Locations 1-5 are simple, content-free color fills — safe to convert to `transform: scaleX()`/`scaleY()` per AUDIT.md's performance guidance (animate `transform`/`opacity` only). Locations 6-8 are **not** safe to convert the same way:

- **#6 (`objetivo-panel.tsx`)**: the fill div has a text child (`{pct}%`) positioned inside it via `flex items-center justify-end`. Scaling the parent with `transform: scaleX()` would visually distort that child text horizontally (non-uniform stretch) — a real visual bug, not just a performance nuance.
- **#7 (`reparaciones-split.tsx`)**: the sibling segment (`flex-1`) and a separate absolutely-positioned marker (`left: ${pct}%`) both derive their position/size from the *actual rendered width* of the first segment. Replacing that segment's `width` with a `transform` would decouple it from its own layout box, breaking the sync between all three elements.
- **#8 (`tendencia-rubros.tsx`)**: the outer container's `height` participates in real layout (`justify-end` alignment against a sibling label above it, inside a `flex-col` parent). Forcing it to always render at full height (to then visually scale down) would overflow/mis-position the label above it.

For these three, the correct trade-off is a plain CSS transition on the actual animated property (`width`/`height`/`left`) — a deliberate, documented exception to the transform-only ideal, chosen because the alternative risks a real layout or visual-distortion bug in a "nice to have" fix.

## Target

### Group A — convert to `transform` (locations 1-5)

**1. `components/dashboard/repairs-chart.tsx:28-34`**

```tsx
// current
<div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-100">
  <div
    className="h-full rounded-full"
    style={{
      width: `${(s.count / max) * 100}%`,
      background: s.color,
    }}
  />
</div>
```

```tsx
// target
<div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-100">
  <div
    className="h-full w-full origin-left rounded-full transition-transform duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]"
    style={{
      transform: `scaleX(${s.count / max})`,
      background: s.color,
    }}
  />
</div>
```

**2. `components/analiticas/funnel-reparaciones.tsx:52-55`**

```tsx
// current
<div className="h-6 min-w-0 flex-1 overflow-hidden rounded-md bg-accent-soft">
  <div
    className="h-6 rounded-md bg-accent"
    style={{ width: `${(e.alcanzados / base) * 100}%` }}
  />
</div>
```

```tsx
// target
<div className="h-6 min-w-0 flex-1 overflow-hidden rounded-md bg-accent-soft">
  <div
    className="h-6 w-full origin-left rounded-md bg-accent transition-transform duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]"
    style={{ transform: `scaleX(${e.alcanzados / base})` }}
  />
</div>
```

**3. `app/(app)/analiticas/analiticas-client.tsx:103-107` (`BarRows`)**

```tsx
// current
<div className="mt-1 h-2 rounded-full bg-neutral-100">
  <div
    className="h-2 rounded-full bg-accent"
    style={{ width: `${(r.value / max) * 100}%` }}
  />
</div>
```

```tsx
// target
<div className="mt-1 h-2 rounded-full bg-neutral-100">
  <div
    className="h-2 w-full origin-left rounded-full bg-accent transition-transform duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]"
    style={{ transform: `scaleX(${r.value / max})` }}
  />
</div>
```

**4. `components/analiticas/flujo-caja.tsx:126-134`** — vertical bars, anchor at the *bottom*, so use `origin-bottom` and `scaleY`. Each bar keeps a fixed pixel max-height (`140px`, the existing scale ceiling) and scales down from there instead of computing a shorter literal height:

```tsx
// current
<div
  className="w-[38%] rounded-t-md bg-emerald-500"
  style={{ height: `${Math.max(4, (m.ingresos / maxFlujo) * 140)}px` }}
/>
<div
  className="w-[38%] rounded-t-md bg-red-400"
  style={{ height: `${Math.max(4, (m.egresos / maxFlujo) * 140)}px` }}
/>
```

```tsx
// target
<div
  className="h-[140px] w-[38%] origin-bottom rounded-t-md bg-emerald-500 transition-transform duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]"
  style={{ transform: `scaleY(${Math.max(4 / 140, m.ingresos / maxFlujo)})` }}
/>
<div
  className="h-[140px] w-[38%] origin-bottom rounded-t-md bg-red-400 transition-transform duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]"
  style={{ transform: `scaleY(${Math.max(4 / 140, m.egresos / maxFlujo)})` }}
/>
```

(`Math.max(4 / 140, ...)` preserves the original "never fully collapse to 0" floor — the old code guaranteed a minimum 4px bar; `4 / 140 ≈ 0.0286` is that same floor expressed as a scale factor against the new fixed 140px box.)

**5. `components/analiticas/inventario-flow.tsx:52-56` (`Barra`)** — same bottom-anchored vertical pattern, existing ceiling is `ALTO = 72` (px):

```tsx
// current
<div className="flex h-[72px] w-6 items-end">
  <div
    className="w-full rounded-t-md"
    style={{ height: `${Math.max(v > 0 ? 3 : 0, (v / maxTodo) * ALTO)}px`, background: color }}
  />
</div>
```

```tsx
// target
<div className="flex h-[72px] w-6 items-end">
  <div
    className="h-full w-full origin-bottom rounded-t-md transition-transform duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]"
    style={{
      transform: `scaleY(${v > 0 ? Math.max(3 / ALTO, v / maxTodo) : 0})`,
      background: color,
    }}
  />
</div>
```

### Group B — plain property transition, documented exception (locations 6-8)

**6. `components/dashboard/objetivo-panel.tsx:56-59`**

```tsx
// current
<div
  className="absolute inset-y-0 left-0 flex items-center justify-end rounded-full pr-2"
  style={{ width: `${pct}%`, background: DASH_ACCENT }}
>
```

```tsx
// target
<div
  className="absolute inset-y-0 left-0 flex items-center justify-end rounded-full pr-2 transition-[width] duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]"
  style={{ width: `${pct}%`, background: DASH_ACCENT }}
>
```

**7. `components/dashboard/reparaciones-split.tsx:29-40`** — add the transition to both the fill segment's `width` and the marker's `left`:

```tsx
// current
<div
  className="h-full"
  style={{ width: `${pct}%`, background: CHART_ACCENT }}
/>
...
<div
  className="absolute -top-1.5 flex -translate-x-1/2 flex-col items-center"
  style={{ left: `${pct}%` }}
>
```

```tsx
// target
<div
  className="h-full transition-[width] duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]"
  style={{ width: `${pct}%`, background: CHART_ACCENT }}
/>
...
<div
  className="absolute -top-1.5 flex -translate-x-1/2 flex-col items-center transition-[left] duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]"
  style={{ left: `${pct}%` }}
>
```

**8. `components/analiticas/tendencia-rubros.tsx:151-157`**

```tsx
// current
<div
  className={cn(
    "flex w-[72%] flex-col gap-[3px] transition-opacity",
    dim && "opacity-40",
  )}
  style={{ height: `${bh(i)}%` }}
>
```

```tsx
// target
<div
  className={cn(
    "flex w-[72%] flex-col gap-[3px] transition-opacity transition-[height] duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]",
    dim && "opacity-40",
  )}
  style={{ height: `${bh(i)}%` }}
>
```

(Keep the existing `transition-opacity` — Tailwind allows both a named transition utility and an arbitrary `transition-[...]` on the same element; they combine into one `transition-property` list. If your Tailwind setup dedupes/overrides instead of combining when two `transition-*` utilities are both present, use `transition-[opacity,height]` as a single utility instead of both.)

## Repo conventions to follow

- `cubic-bezier(0.77, 0, 0.175, 1)` is AUDIT.md's prescribed strong `ease-in-out` curve, already introduced in plan 009 for the same "a value on screen moves/morphs" case — reuse it here for consistency rather than picking a new curve.
- `duration-300` sits at the outer edge of AUDIT.md's "UI animations stay under 300ms" ceiling — appropriate here since these are chart-level, occasional (period/filter-change-triggered) transitions, not high-frequency hover feedback.
- `origin-left`/`origin-bottom` (Tailwind `transform-origin` utilities) and arbitrary `transition-[...]`/`scaleX`/`scaleY` syntax are already established in plans 003, 007, 008, 009 — consistent usage throughout this plan set.

## Steps

Apply each of the 8 changes above independently — they are unrelated to each other and can be done in any order:

1. `components/dashboard/repairs-chart.tsx` — apply Group A, item 1.
2. `components/analiticas/funnel-reparaciones.tsx` — apply Group A, item 2.
3. `app/(app)/analiticas/analiticas-client.tsx` (`BarRows` function) — apply Group A, item 3.
4. `components/analiticas/flujo-caja.tsx` — apply Group A, item 4 (both the ingresos and egresos bars).
5. `components/analiticas/inventario-flow.tsx` (`Barra` helper) — apply Group A, item 5.
6. `components/dashboard/objetivo-panel.tsx` — apply Group B, item 6.
7. `components/dashboard/reparaciones-split.tsx` — apply Group B, item 7 (both the fill segment and the marker).
8. `components/analiticas/tendencia-rubros.tsx` — apply Group B, item 8.

## Boundaries

- Do NOT apply the Group A (`transform`) treatment to any Group B file — re-read the Problem section's reasoning before touching #6, #7, or #8; a transform conversion there is a correctness risk (distorted text or broken layout sync), not just a style choice.
- Do NOT touch `components/analiticas/clientes/procedencia-ranking.tsx` — it's already covered by plan 009 with the same `scaleX` pattern, applied separately because it already had a (wrong) transition, unlike these 8 which have none.
- Do NOT change how any of the underlying values (`max`, `pct`, `bh(i)`, `maxFlujo`, `maxTodo`, etc.) are computed — only how the resulting style/className is applied.
- For Group A conversions, do NOT drop the `overflow-hidden` on each bar's outer track — it's required to clip the now-`w-full`/`h-full` inner bar to the track's actual visible size.
- If any of the 8 cited code blocks doesn't match what's shown above (drift since commit `5e82fe8`), STOP and report which one instead of guessing.

## Verification

- **Mechanical**: `npx tsc --noEmit` and `npx vitest run` — expect no errors (all changes are JSX/style/className only, no logic touched).
- **Feel check**: run `npm run dev`.
  - Dashboard: change the trend/period selector and confirm the Repairs pipeline chart's bars now ease to their new lengths instead of jumping. Confirm "Objetivo del mes"'s bar (with its `%` chip) eases smoothly with no text distortion. Confirm "Reparaciones" split bar and its dashed marker move together in sync, easing rather than jumping.
  - Analíticas: switch tabs/filters that affect the funnel, `BarRows`-based rankings, flujo de caja bars, inventario flow bars, and tendencia-rubros stacked bars — confirm each now eases to its new value.
  - In DevTools' Performance panel, record one Group A change (e.g. the repairs pipeline) and confirm the animated property is `transform`, not `width`/`height` (no Layout recalculation attributable to it).
  - Confirm Group B's `objetivo-panel` chip text stays crisp and undistorted throughout its transition (no horizontal stretching of the `{pct}%` text).
- **Done when**: all 8 locations transition instead of teleporting, Group A locations animate via `transform` only, Group B locations animate their plain property with no visual/layout regression, and `tsc --noEmit`/`vitest run` both pass.
