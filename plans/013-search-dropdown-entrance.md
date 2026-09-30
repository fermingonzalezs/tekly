# 013 — Add entrance motion to the client/item search dropdowns

- **Status**: DONE
- **Commit**: 5e82fe8
- **Severity**: MEDIUM (missed opportunity)
- **Category**: Missed opportunities / Physicality & origin
- **Estimated scope**: 3 files (+ `tailwind.config.ts` if plan 007 hasn't run yet)

## Problem

The single most-opened floating panel in the app — the client/item search combobox used in Ventas, Reparaciones, Cuentas corrientes, and Turnos — mounts and unmounts with a bare conditional and zero transition:

```tsx
// components/ui/cliente-picker.tsx:111-112 — current
{open && (
  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
```

```tsx
// app/(app)/ventas/ventas-client.tsx:1385-1386 — current (ItemBuscador)
{open && (
  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
```

```tsx
// app/(app)/turnos/turnos-client.tsx:1369-1370 — current (equipo/producto search)
{open && (
  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
```

Every new venta, ticket, movimiento de cuenta corriente, and turno opens one of these at least once. AUDIT.md category 8 flags exactly this: a floating panel appearing from a trigger (here, the search input directly above it) "with no motion explaining where it came from." `TopNav`'s own category dropdown already gets *some* animation treatment today (before plan 007 fixes its physicality) — these three comboboxes, despite being opened far more often, get none at all.

## Target

Give all three the same trigger-anchored entrance used for the app's other corner/edge-anchored dropdowns: a small scale+opacity animation, top-anchored (these panels sit directly below their full-width input, `mt-1 w-full`, so `origin-top` is the correct anchor — there's no left/right asymmetry to account for).

This reuses the `menu-in` token introduced in plan 007. **Check `tailwind.config.ts` first**: if `theme.extend.keyframes.menu-in` and `theme.extend.animation.menu-in` already exist (plan 007 already applied in this worktree), skip straight to step 2 below. If they don't exist yet, add them now, identical to plan 007's definition:

```ts
// tailwind.config.ts — add inside theme.extend.keyframes, only if not already present
"menu-in": {
  from: { opacity: "0", transform: "scale(0.96)" },
  to: { opacity: "1", transform: "scale(1)" },
},
```

```ts
// tailwind.config.ts — add inside theme.extend.animation, only if not already present
"menu-in": "menu-in 0.18s cubic-bezier(0.23, 1, 0.32, 1)",
```

Then apply it with a top origin in each of the three files:

```tsx
// components/ui/cliente-picker.tsx:111-112 — target
{open && (
  <div className="animate-menu-in origin-top absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
```

```tsx
// app/(app)/ventas/ventas-client.tsx:1385-1386 — target
{open && (
  <div className="animate-menu-in origin-top absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
```

```tsx
// app/(app)/turnos/turnos-client.tsx:1369-1370 — target
{open && (
  <div className="animate-menu-in origin-top absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
```

Also extend the reduced-motion override block in `app/globals.css` (added by plan 006, or plan 007 if that ran first) to include `.animate-menu-in` if it isn't already listed there — plan 007 already adds this selector, so if plan 007 has run, no further CSS change is needed here. If neither plan 006 nor plan 007 has run in this worktree, add a fresh block:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-menu-in {
    animation: fade-in 0.18s cubic-bezier(0.23, 1, 0.32, 1);
  }
}
```//insert after the `input[type="number"]` rules, before `@media print`, in `app/globals.css`.

## Repo conventions to follow

- Reuse the exact `menu-in` token from plan 007 rather than inventing a fourth near-identical entrance animation — if both plans run in the same worktree, the `tailwind.config.ts` addition only needs to happen once (whichever plan runs first).
- Tailwind's `origin-top` utility and the `animate-menu-in` class name follow the same convention already used for `animate-toast-in`/`animate-fade-in`/`animate-drawer-in`.

## Steps

1. Open `tailwind.config.ts`. If `menu-in` is not already present under `theme.extend.keyframes` and `theme.extend.animation`, add both entries shown in the Target section.
2. Open `components/ui/cliente-picker.tsx`. On lines 111-112, add `animate-menu-in origin-top` to the start of the dropdown `<div>`'s className (keep every existing class).
3. Open `app/(app)/ventas/ventas-client.tsx`. Find the `ItemBuscador` dropdown (around lines 1385-1386) and apply the identical prefix as step 2.
4. Open `app/(app)/turnos/turnos-client.tsx`. Find the equipo/producto search dropdown (around lines 1369-1370) and apply the identical prefix as step 2.
5. Open `app/globals.css`. If no `@media (prefers-reduced-motion: reduce)` block exists yet, add the one shown in the Target section (after the `input[type="number"]` rules, before `@media print`). If one already exists (from plan 006 or 007), add `.animate-menu-in` to its fade-in selector group only if it isn't already listed there.

## Boundaries

- Do NOT add an exit animation to any of these three dropdowns — they continue to hard-unmount on close, matching plan 007's scope decision for the same reason (not part of this finding).
- Do NOT touch any other combobox/dropdown in the app beyond these three exact locations.
- Do NOT change the search/filter logic (`matches`, `onAdd`, `onAddEquipo`, `onAddOtro`, `setQ`, `setOpen`, etc.) in any of the three files — className additions only.
- If any of the three cited blocks doesn't match what's shown above (drift since commit `5e82fe8`), STOP and report instead of guessing.

## Verification

- **Mechanical**: `npx tsc --noEmit` — expect no errors. Restart `npm run dev` if `tailwind.config.ts` was changed in step 1.
- **Feel check**: run `npm run dev`.
  - Open Ventas → "Nueva venta", focus the client picker input — confirm the results dropdown now scales+fades in from the top, anchored under the input, instead of appearing instantly.
  - In the same modal, focus the item search input (`ItemBuscador`) — same check.
  - Open Turnos → agendar/vincular equipo, focus the equipo/producto search — same check.
  - Enable "Emulate CSS prefers-reduced-motion: reduce" in DevTools and confirm all three still fade in (opacity only, no scale).
- **Done when**: all three dropdowns animate in with `animate-menu-in origin-top`, `tsc --noEmit` passes, and reduced-motion emulation shows an opacity-only entrance for all three.
