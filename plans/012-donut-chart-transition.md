# 012 — Animate donut chart segments on data change

- **Status**: DONE
- **Commit**: 5e82fe8
- **Severity**: LOW (missed opportunity)
- **Category**: Missed opportunities
- **Estimated scope**: 1 file, 1-line change

## Problem

```tsx
// components/dashboard/donut-chart.tsx:60-73 — current
{segs.map((s, i) => (
  <circle
    key={i}
    cx={CXY}
    cy={CXY}
    r={R}
    fill="none"
    stroke={s.color}
    strokeWidth={SW}
    strokeLinecap="butt"
    strokeDasharray={`${s.len} ${C - s.len}`}
    strokeDashoffset={s.dashOffset}
  />
))}
```

`DonutChart` is used for the dashboard's "Categorías más vendidas" mix (Equipos/Reparaciones/Accesorios/Otros) and swaps its segments whenever the period selector changes. Each `<circle>`'s `strokeDasharray`/`strokeDashoffset` currently has no transition — the ring's segments teleport straight to their new lengths/offsets on every mount or data change. AUDIT.md category 8: "State changes that teleport ... where a brief transition would prevent a jarring change" — a segmented ring redistributing its arcs is a canonical case for this.

## Target

Both `stroke-dasharray` and `stroke-dashoffset` are standard animatable SVG presentation properties and transition cleanly via plain CSS — add a `transition` class to each segment circle:

```tsx
// target
{segs.map((s, i) => (
  <circle
    key={i}
    cx={CXY}
    cy={CXY}
    r={R}
    fill="none"
    stroke={s.color}
    strokeWidth={SW}
    strokeLinecap="butt"
    strokeDasharray={`${s.len} ${C - s.len}`}
    strokeDashoffset={s.dashOffset}
    className="transition-[stroke-dasharray,stroke-dashoffset] duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]"
  />
))}
```

`cubic-bezier(0.77, 0, 0.175, 1)` is AUDIT.md's prescribed strong `ease-in-out` curve (already used for the same "value on screen redistributes" case in plans 009 and 011). `duration-300` sits at the edge of AUDIT.md's UI ceiling, appropriate for an occasional, period-change-triggered chart update rather than a hover/click.

## Repo conventions to follow

- Tailwind's arbitrary `transition-[...]` syntax listing multiple properties is already established in this plan set (e.g. plan 012's sibling plans 003, 008, 011) — same pattern, applied to SVG presentation attributes instead of CSS box properties.
- Do not add a `key`-based remount trick or React Spring/Framer Motion — this is a pure CSS fix, consistent with the rest of this component (no animation library is used anywhere in the CRM's dashboard/analytics code).

## Steps

1. Open `components/dashboard/donut-chart.tsx`. Locate the segment-rendering `<circle>` inside `segs.map((s, i) => (...))` (around lines 60-73).
2. Add a `className` prop to that `<circle>` with the value `"transition-[stroke-dasharray,stroke-dashoffset] duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]"`. Do not add or change any other prop on this element (`cx`, `cy`, `r`, `fill`, `stroke`, `strokeWidth`, `strokeLinecap`, `strokeDasharray`, `strokeDashoffset` all stay exactly as they are).

## Boundaries

- Do NOT touch the base ring `<circle>` (the plain white background ring at lines 52-59) — it never changes value, nothing to transition.
- Do NOT touch the radial separator `<line>` elements or the percentage-label `<text>`/`<rect>` chips — those reposition instantly alongside the arcs today and are out of scope for this plan (repositioning them would require recomputing their angle mid-transition, a materially bigger change than this plan's scope).
- Do NOT change `legend="row"` vs `legend="list"` rendering, or any legend markup.
- If the segment `<circle>` block doesn't match the snippet above exactly (drift since commit `5e82fe8`), STOP and report instead of guessing.

## Verification

- **Mechanical**: `npx tsc --noEmit` — expect no errors (adding a `className` to an SVG element is standard JSX).
- **Feel check**: run `npm run dev`, go to the Dashboard, and change the period/trend selector so the "Categorías más vendidas" mix updates:
  - Confirm each colored arc now eases to its new length/position instead of snapping instantly.
  - Confirm the white radial separators and `%` chips still reposition (instantly, as before — not part of this fix) without looking broken relative to the now-animated arcs (a brief mismatch during the 300ms transition is expected and acceptable; this plan only fixes the arcs themselves).
- **Done when**: `tsc --noEmit` passes and changing the underlying data visibly eases the donut's arcs instead of teleporting them.
