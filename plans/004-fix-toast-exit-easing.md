# 004 — Fix toast exit easing from `ease-in` to `ease-out`

- **Status**: DONE
- **Commit**: 5e82fe8
- **Severity**: HIGH
- **Category**: Easing & duration
- **Estimated scope**: 1 file, 1-line change

## Problem

```css
/* tailwind.config.ts:59-65 — current */
animation: {
  "toast-in": "toast-in 0.22s cubic-bezier(0.21, 1.02, 0.73, 1)",
  "toast-out": "toast-out 0.18s ease-in forwards",
  "celebrate-in": "celebrate-in 0.25s ease-out",
  "celebrate-check": "celebrate-check 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both",
  "fade-in": "fade-in 0.18s ease-out",
  "drawer-in": "drawer-in 0.22s cubic-bezier(0.21, 1.02, 0.73, 1)",
},
```

`toast-out` is applied in `components/notifications/toaster.tsx:66` (`t.leaving ? "animate-toast-out" : "animate-toast-in"`) every time a toast is dismissed — which happens on every sale/ticket/turno/notification event in the app, either after its 5-second auto-life or on manual dismiss. AUDIT.md's easing decision order puts **both** entering and exiting under `ease-out` ("starts fast, feels responsive"), and separately states: "`ease-in` on UI is always a finding — it starts slow, delaying the exact moment the user is watching." A toast dismiss with `ease-in` visibly lags at the start of its exit, right when the user's attention is on it leaving.

## Target

```css
/* tailwind.config.ts:61 — target */
"toast-out": "toast-out 0.18s cubic-bezier(0.23, 1, 0.32, 1) forwards",
```

This uses AUDIT.md's prescribed strong ease-out curve (`cubic-bezier(0.23, 1, 0.32, 1)`, listed under "Easing & duration" as the value to introduce for deliberate motion — built-in CSS easings are described as "too weak"). The duration (`0.18s`) and `forwards` fill-mode are unchanged.

## Repo conventions to follow

- Every animation in this repo is defined as a single string in `tailwind.config.ts`'s `animation` object, combining the keyframe name, duration, easing, and fill-mode inline (no separate CSS custom properties for easing exist yet in this codebase) — this fix follows that exact existing pattern, it does not introduce a new token mechanism.
- `toast-in` (the sibling entry one line above) already uses a strong custom cubic-bezier rather than a bare CSS keyword — this fix brings `toast-out` in line with that same standard, using AUDIT.md's canonical strong-ease-out value instead of inventing a new curve.

## Steps

1. Open `tailwind.config.ts`. On the `"toast-out"` line inside `theme.extend.animation` (line 61), replace:
   ```ts
   "toast-out": "toast-out 0.18s ease-in forwards",
   ```
   with:
   ```ts
   "toast-out": "toast-out 0.18s cubic-bezier(0.23, 1, 0.32, 1) forwards",
   ```
2. Do not change the `toast-out` keyframes definition (lines 37-40) — only the `animation` entry's easing function.

## Boundaries

- Do NOT touch `toast-in`, `celebrate-in`, `celebrate-check`, `fade-in`, or `drawer-in` — only the `toast-out` entry.
- Do NOT touch `components/notifications/toaster.tsx` — the class name (`animate-toast-out`) and where it's applied are unchanged; only the underlying Tailwind config value changes.
- Do NOT add a new CSS custom property or a separate easing token file — follow the existing inline-string convention in `tailwind.config.ts`.
- If the `"toast-out"` line does not match the snippet above exactly (drift since commit `5e82fe8`), STOP and report instead of guessing.

## Verification

- **Mechanical**: `npx tsc --noEmit` — expect no errors (this is a `.ts` config value change with no type implications). Restart `npm run dev` after saving (Tailwind config changes require a dev server restart to take effect reliably).
- **Feel check**: run `npm run dev`, trigger a toast (e.g. perform an action that fires a notification, or open two browser tabs on the same org and do something in one — see `lib/realtime.ts`), and confirm:
  - The toast's exit (auto-dismiss after ~5s, or manual dismiss if a close affordance exists) now starts fast and settles into its offscreen position, rather than easing in slowly at the start.
  - In DevTools' Animations panel (or by setting playback rate to 10%), scrub the exit animation and confirm the translateX/scale motion is fastest at the very start of the 180ms, not the end.
- **Done when**: `tailwind.config.ts`'s `toast-out` animation entry uses `cubic-bezier(0.23, 1, 0.32, 1)` instead of `ease-in`, and a triggered toast's dismiss visibly starts fast rather than slow.
