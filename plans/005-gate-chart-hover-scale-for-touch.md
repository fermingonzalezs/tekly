# 005 — Gate scatter/cohort hover-scale behind `(hover: hover) and (pointer: fine)`

- **Status**: DONE
- **Commit**: 5e82fe8
- **Severity**: HIGH
- **Category**: Accessibility
- **Estimated scope**: 3 files, 1-line change each

## Problem

Three chart components apply a `hover:scale-*` transform to many small, densely-packed interactive targets, with no gating for touch input:

```tsx
// components/analiticas/clientes/value-map.tsx:116-119 — current
className={cn(
  "absolute -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-white transition-all duration-150 hover:z-20 hover:scale-125",
  coincide ? "opacity-75 hover:opacity-100" : "opacity-[0.12]",
)}
```

```tsx
// components/analiticas/clientes/compras-reparaciones-map.tsx:117 — current (identical pattern)
"absolute -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-white transition-all duration-150 hover:z-20 hover:scale-125",
```

```tsx
// components/analiticas/clientes/cohort-heatmap.tsx:101-104 — current
className={cn(
  "h-full w-full rounded-md text-[11px] font-semibold tabular-nums transition-transform hover:scale-[1.04]",
  cell.dark ? "text-neutral-700" : "text-white",
  esSel && "ring-2 ring-accent ring-offset-1",
)}
```

Both scatter maps plot up to 220 points each (`value-map.tsx`/`compras-reparaciones-map.tsx`); the cohort heatmap has a full grid of clickable cells. AUDIT.md flags exactly this pattern: "ungated `:hover` motion" — on a touch device, tapping one of these targets fires a synthetic `:hover` state with no corresponding `mouseleave` to clear it, so the tapped dot/cell visibly jumps to 125%/104% scale and can stay there after the tap (since the drill-down/navigation triggered by the click may not itself force a hover-state reset).

## Target

Wrap each `hover:` utility in Tailwind's pointer-fine media-query variant, which only applies on devices with a real, precise pointer (mouse/trackpad) and a real hover capability — exactly the AUDIT.md-prescribed pattern:

```css
@media (hover: hover) and (pointer: fine) {
  .element:hover { transform: scale(1.05); } /* touch fires false hovers on tap */
}
```

In Tailwind's class syntax, this is the `hover-hover:` and `pointer-fine:` variants stacked, or more simply the single combined arbitrary variant. Use the stacked-variant form (both are built-in Tailwind 3 media-feature variants, no config change needed):

```tsx
// value-map.tsx and compras-reparaciones-map.tsx — target
"absolute -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-white transition-all duration-150 [@media(hover:hover)_and_(pointer:fine)]:hover:z-20 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-125",
```

```tsx
// cohort-heatmap.tsx — target
"h-full w-full rounded-md text-[11px] font-semibold tabular-nums transition-transform [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.04]",
```

If the executor's Tailwind version/setup supports the shorter built-in `hover:` variant already being pointer-aware (Tailwind 3.4+ makes bare `hover:` conditional on `(hover: hover)` automatically via `@media not all and (hover: none)` under the hood in some configurations) — check `package.json`'s `tailwindcss` version first. This repo pins `"tailwindcss"` — read the exact version from `package.json` before assuming; if it is below 3.4, the explicit arbitrary-variant form above is required. Prefer the explicit arbitrary-variant form regardless, since it is unambiguous and self-documenting.

## Repo conventions to follow

- No existing component in this codebase gates hover behind a pointer-media-query yet — this introduces the first instance of the pattern. Apply it identically across all three files so it reads as one consistent convention, not three different workarounds.
- Do not extract this into a shared Tailwind plugin or custom variant for this plan — a direct, duplicated arbitrary-variant string in each of the three files is consistent with how these three files already duplicate their near-identical dot/cell styling (see the audit's own note that `value-map.tsx:117` and `compras-reparaciones-map.tsx:117` are already byte-for-byte identical).

## Steps

1. Open `components/analiticas/clientes/value-map.tsx`. On line 117, replace:
   ```tsx
   "absolute -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-white transition-all duration-150 hover:z-20 hover:scale-125",
   ```
   with:
   ```tsx
   "absolute -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-white transition-all duration-150 [@media(hover:hover)_and_(pointer:fine)]:hover:z-20 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-125",
   ```
2. Open `components/analiticas/clientes/compras-reparaciones-map.tsx`. On line 117, apply the identical replacement as step 1.
3. Open `components/analiticas/clientes/cohort-heatmap.tsx`. On line 103, replace:
   ```tsx
   "h-full w-full rounded-md text-[11px] font-semibold tabular-nums transition-transform hover:scale-[1.04]",
   ```
   with:
   ```tsx
   "h-full w-full rounded-md text-[11px] font-semibold tabular-nums transition-transform [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.04]",
   ```

## Boundaries

- Do NOT change `onMouseEnter`/`onMouseLeave`/`onClick` handlers, the tooltip logic, or any other className fragment (e.g. `opacity-75 hover:opacity-100` in value-map.tsx, `ring-2 ring-accent ring-offset-1` in cohort-heatmap.tsx) — only the scale/z-index hover variants.
- Do NOT touch `components/analiticas/tendencia-rubros.tsx`, `components/marketing/features.tsx`, or any other `hover:scale`/`hover:-translate-y` usage elsewhere in the app — those were not flagged in this audit round and are out of scope.
- If any of the three cited lines does not match the snippets above exactly (drift since commit `5e82fe8`), STOP and report instead of guessing.

## Verification

- **Mechanical**: `npx tsc --noEmit` — expect no errors (className-only change). Run `npm run build` if feasible to confirm Tailwind's JIT compiler accepts the arbitrary-variant syntax without warnings (check build output for any "unknown utility" messages).
- **Feel check**: run `npm run dev`, open Chrome DevTools, toggle device emulation to a touch device (e.g. "iPad" preset, which reports `pointer: coarse` / no real hover), navigate to Analíticas → Clientes tab:
  - Tap a dot in the value map (or the compras-vs-reparaciones map) — confirm it does NOT scale up to 125%/get a z-index bump on tap.
  - Switch DevTools back to a non-touch/desktop emulation (or test on a real trackpad) and confirm mouse hover on a dot still scales it to 125% and raises its z-index smoothly, unchanged from before.
  - Repeat both checks on the cohort heatmap cells (scale to 1.04).
- **Done when**: all three files pass `tsc --noEmit`, touch/coarse-pointer emulation shows no hover-scale on tap, and real mouse hover still shows the original scale effect unchanged.
