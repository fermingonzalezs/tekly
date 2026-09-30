# 007 — Dedicated trigger-anchored `menu-in` token for corner dropdowns

- **Status**: DONE
- **Commit**: 5e82fe8
- **Severity**: MEDIUM
- **Category**: Physicality & origin / Cohesion & tokens
- **Estimated scope**: 4 files (`tailwind.config.ts`, `components/notifications/bell.tsx`, `components/auth/user-menu.tsx`, `components/topnav.tsx`) + 1 CSS addition

## Problem

Three trigger-anchored dropdown menus don't visually originate from their trigger:

```tsx
// components/notifications/bell.tsx:85 — current
<div className="animate-toast-in absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
```

```tsx
// components/auth/user-menu.tsx:49 — current
<div className="animate-toast-in absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
```

```tsx
// components/topnav.tsx:118 — current
<div className="animate-fade-in absolute left-1/2 top-full z-50 mt-2 w-52 -translate-x-1/2 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-xl">
```

The bell and user-menu panels reuse `animate-toast-in`, whose keyframes slide in from `translateX(24px)` — a horizontal slide with no relationship to either panel's actual trigger (a bell icon / avatar directly above them). The TopNav category dropdown uses a pure opacity `fade-in` with no transform at all — AUDIT.md explicitly hunts for "pure-fade entrances with no initial transform." AUDIT.md's rule is direct: "Popovers/dropdowns/tooltips scale from their trigger, not center" (with `transform-origin` set at the trigger). One token (`toast-in`) is also currently overloaded across 4 structurally different surfaces (a centered modal, a centered command palette, and these two corner menus) — AUDIT.md's cohesion category flags reusing one easing/animation token across incompatible contexts as a consolidation problem in the wrong direction.

## Target

### 1. New `menu-in` keyframes/animation in `tailwind.config.ts`

A small scale+opacity entrance, sized for a dropdown/popover (AUDIT.md's duration budget: "Dropdowns, selects: 150-250ms"):

```ts
// tailwind.config.ts — add inside theme.extend.keyframes
"menu-in": {
  from: { opacity: "0", transform: "scale(0.96)" },
  to: { opacity: "1", transform: "scale(1)" },
},
```

```ts
// tailwind.config.ts — add inside theme.extend.animation
"menu-in": "menu-in 0.18s cubic-bezier(0.23, 1, 0.32, 1)",
```

(If plan 006 has already added other keyframes/animation entries to this file, add `menu-in` as one more sibling entry in each object — do not remove or reorder anything else already there.)

### 2. Apply the token with the correct `transform-origin` at each trigger

`components/notifications/bell.tsx:85` — the bell sits at the panel's top-right corner (`right-0 top-full`):

```tsx
// target
<div className="animate-menu-in origin-top-right absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
```

`components/auth/user-menu.tsx:49` — same corner geometry:

```tsx
// target
<div className="animate-menu-in origin-top-right absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
```

`components/topnav.tsx:118` — this panel is horizontally centered under its trigger (`left-1/2 -translate-x-1/2`), so its origin is top-center, not top-right:

```tsx
// target
<div className="animate-menu-in origin-top absolute left-1/2 top-full z-50 mt-2 w-52 -translate-x-1/2 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-xl">
```

### 3. Reduced-motion branch in `app/globals.css`

Add `.animate-menu-in` to the reduced-motion override block. If plan 006 already added this block (see its section 4), add `.animate-menu-in` as one more selector in its first rule instead of creating a second `@media` block:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-modal-in,
  .animate-drawer-in,
  .animate-menu-in {
    animation: fade-in 0.18s cubic-bezier(0.23, 1, 0.32, 1);
  }
  .animate-modal-out,
  .animate-drawer-out {
    animation: fade-out 0.18s cubic-bezier(0.23, 1, 0.32, 1) forwards;
  }
}
```

If plan 006 has not run yet in this worktree, add the whole block fresh (after the `input[type="number"]` rules, before `@media print`), with only the `.animate-menu-in` selector in the first rule and no `-out` rule (since this plan doesn't add exit animations — see Boundaries):

```css
@media (prefers-reduced-motion: reduce) {
  .animate-menu-in {
    animation: fade-in 0.18s cubic-bezier(0.23, 1, 0.32, 1);
  }
}
```

## Repo conventions to follow

- Tailwind's built-in `origin-*` utilities (`origin-top-right`, `origin-top`, etc.) set `transform-origin` — no custom CSS needed, this is standard Tailwind already available in this project's version.
- Keep the new `menu-in` keyframes/animation entries in `tailwind.config.ts` alongside the existing ones, following the exact structure already used for `toast-in`/`fade-in`/`drawer-in`.

## Steps

1. Open `tailwind.config.ts`. Add the `menu-in` keyframes entry (Target section 1) inside `theme.extend.keyframes`, and the `menu-in` animation entry inside `theme.extend.animation`.
2. Open `components/notifications/bell.tsx`. On line 85, replace `animate-toast-in` with `animate-menu-in origin-top-right` (keep every other class on that line unchanged).
3. Open `components/auth/user-menu.tsx`. On line 49, apply the identical replacement as step 2.
4. Open `components/topnav.tsx`. On line 118, replace `animate-fade-in` with `animate-menu-in origin-top` (keep every other class on that line unchanged).
5. Open `app/globals.css`. Add or extend the reduced-motion block as described in Target section 3, depending on whether plan 006 has already added one.

## Boundaries

- Do NOT add exit-before-unmount animation to any of these three dropdowns — that was not part of this finding (Dialog/MobileNavDrawer's missing exit animation is plan 006's separate scope). These three continue to hard-unmount on close; only their entrance changes.
- Do NOT touch `components/ui/dialog.tsx`, `components/mobile-nav-drawer.tsx`, or `components/command-palette/command-palette.tsx` — the modal/palette/drawer surfaces are out of scope for this plan (see plans 001 and 006).
- Do NOT change the `open`/`onClick`/outside-click-detection logic in any of the three files — className changes only.
- If any of the three cited lines doesn't match the snippets above exactly (drift since commit `5e82fe8`), STOP and report instead of guessing.

## Verification

- **Mechanical**: `npx tsc --noEmit` — expect no errors. Restart `npm run dev` after the `tailwind.config.ts` edit.
- **Feel check**: run `npm run dev`.
  - Click the notification bell — confirm the panel now scales in from its top-right corner (near the bell icon), not from its own center or with a horizontal slide.
  - Click the user avatar menu — same check, scaling from top-right near the avatar.
  - On desktop width, click a TopNav category with a dropdown (e.g. one with multiple children) — confirm the panel now scales in from top-center, directly under the chevron, instead of a flat fade with no movement.
  - In DevTools' Animations panel, set playback to 10% on each and confirm the scale visibly originates from the stated corner/center, not from the panel's geometric center.
  - Enable "Emulate CSS prefers-reduced-motion: reduce" and confirm all three still fade in (opacity only), no scale.
- **Done when**: all three dropdowns use `animate-menu-in` with the correct `origin-*` class, `animate-toast-in` no longer appears in `bell.tsx` or `user-menu.tsx`, and reduced-motion emulation shows opacity-only entrances for all three.
