# 009 — Switch procedencia-ranking bar fill from `width` to `transform: scaleX()`

- **Status**: DONE
- **Commit**: 5e82fe8
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 1 file, 1-line change

## Problem

```tsx
// components/analiticas/clientes/procedencia-ranking.tsx:93-97 — current
<div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
  <div
    className="h-full rounded-full transition-all"
    style={{ width: `${w}%`, background: colorDe(f.label === SIN_PROCEDENCIA ? null : f.label) }}
  />
</div>
```

This bar's fill animates via `width` — a layout property (triggers layout + paint + composite) — and `transition-all` compounds the problem by also transitioning any other property that happens to change. Per AUDIT.md category 5: "Animate `transform` and `opacity` only... `transition: all` animates unintended properties off-GPU — always a finding." This fires on every toggle of the Clientes/Ingresos view and every channel-filter click in Analíticas → Clientes.

## Target

Render the inner bar at a fixed `w-full` and drive its visible length with `transform: scaleX()` from a left-anchored origin instead, so the browser only ever animates `transform` (GPU-composited, no layout/paint cost):

```tsx
// target
<div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
  <div
    className="h-full w-full origin-left rounded-full transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)]"
    style={{ transform: `scaleX(${w / 100})`, background: colorDe(f.label === SIN_PROCEDENCIA ? null : f.label) }}
  />
</div>
```

- `origin-left` (Tailwind's `transform-origin: left`) makes the bar grow/shrink from its left edge — matching how `width` visually behaved before (anchored left inside its track).
- `w` (already a 0-100 percentage number in this component, per the current `${w}%` interpolation) is divided by 100 to produce the 0-1 `scaleX` factor.
- Easing: `cubic-bezier(0.77, 0, 0.175, 1)` is AUDIT.md's prescribed strong `ease-in-out` curve — used here because the bar visually "moves/morphs on screen" to a new value on filter change, which is that category's decision-order match (not a hover/color change, not a pure entrance).
- Duration: `200ms`, comfortably under AUDIT.md's 300ms UI ceiling.

## Repo conventions to follow

- Tailwind's `origin-*` utilities and arbitrary-value `ease-[cubic-bezier(...)]` syntax are already used elsewhere in this plan set (plans 003, 007, 008) — consistent usage.
- `colorDe(...)` and the `SIN_PROCEDENCIA` check are unrelated to this fix and must be called with the exact same arguments as today.

## Steps

1. Open `components/analiticas/clientes/procedencia-ranking.tsx`. Locate the block at lines 93-97 (inside the ranking list item's bar track).
2. Replace:
   ```tsx
   <div
     className="h-full rounded-full transition-all"
     style={{ width: `${w}%`, background: colorDe(f.label === SIN_PROCEDENCIA ? null : f.label) }}
   />
   ```
   with:
   ```tsx
   <div
     className="h-full w-full origin-left rounded-full transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)]"
     style={{ transform: `scaleX(${w / 100})`, background: colorDe(f.label === SIN_PROCEDENCIA ? null : f.label) }}
   />
   ```
3. Do not change the outer track `<div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">` — it already correctly clips the scaled inner bar via `overflow-hidden`.

## Boundaries

- Do NOT touch how `w` is computed elsewhere in the file (its calculation from `f.pct`/`f.clientes`/`f.valorUsd` etc. is unrelated to this fix — only its consumption inside `style` changes, from `width` to `transform`).
- Do NOT touch `components/dashboard/repairs-chart.tsx`, `reparaciones-split.tsx`, `objetivo-panel.tsx`, or any other bar chart — those are separately covered by the missed-opportunities plan (011) with a different fix pattern (they currently have no transition at all, this file already had one that was just wrong).
- If lines 93-97 don't match the snippet above exactly (drift since commit `5e82fe8`), STOP and report instead of guessing.

## Verification

- **Mechanical**: `npx tsc --noEmit` — expect no errors (JSX/style-only change).
- **Feel check**: run `npm run dev`, navigate to Analíticas → Clientes tab, find the channel/procedencia ranking list:
  - Toggle between "Clientes" and "Ingresos" view (or click a channel filter if that re-triggers the ranking) and confirm each bar's fill still visibly animates to its new length, anchored on the left, same as before.
  - In DevTools' Performance panel, record a toggle and confirm the animated property is `transform`, not `width` (no purple "Layout" bars attributable to this element during the transition).
- **Done when**: `transform: scaleX(...)` drives the bar's fill (no `width` in the inline style), the visual anchor is still left-aligned, and `tsc --noEmit` passes.
