# 010 — Add `:active` press feedback to Button outline/ghost and clickable StatCard

- **Status**: DONE
- **Commit**: 5e82fe8
- **Severity**: LOW
- **Category**: Physicality & origin (press feedback)
- **Estimated scope**: 2 files, 1-line change each

## Problem

```tsx
// components/ui/button.tsx:24-33 — current
variant === "primary" && [
  "text-white bg-[linear-gradient(180deg,var(--chart-3),var(--chart-2))]",
  // Oscurecer por brillo (no hex por paleta) -- sigue funcionando
  // con cualquier tema activo.
  "hover:brightness-95 active:brightness-90",
],
variant === "outline" &&
  "border border-neutral-200 bg-white text-neutral-600 shadow-sm hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900",
variant === "ghost" &&
  "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
```

`primary` gets a brightness-dim on `:active`; `outline` and `ghost` (2 of the 3 button variants) have no `:active` state at all — zero tactile confirmation that a click registered before the hover color settles in. AUDIT.md's spec: "Press feedback: `transform: scale(0.97)` on `:active`... Keep it subtle (0.95–0.98)."

```tsx
// components/ui/stat-card.tsx:63-72 — current
return (
  <Card
    onClick={onClick}
    className={cn(
      "overflow-hidden p-3 sm:p-4",
      center && "text-center",
      onClick && "cursor-pointer transition-colors hover:border-neutral-300",
      active && "border-accent bg-accent-soft",
      className,
    )}
  >
```

`StatCard` is used as a real click target (page-level filters: the Reparaciones pipeline, the Cajas medio-de-pago filter), not just a decorative stat — it also has only a hover state, no press feedback.

## Target

Add `active:scale-[0.97]` to all three `Button` variants (on top of `primary`'s existing brightness dim — the two effects combine, giving every variant the same tactile press regardless of color treatment) and to clickable `StatCard`s.

```tsx
// components/ui/button.tsx — target
variant === "primary" && [
  "text-white bg-[linear-gradient(180deg,var(--chart-3),var(--chart-2))]",
  // Oscurecer por brillo (no hex por paleta) -- sigue funcionando
  // con cualquier tema activo.
  "hover:brightness-95 active:brightness-90 active:scale-[0.97]",
],
variant === "outline" &&
  "border border-neutral-200 bg-white text-neutral-600 shadow-sm hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 active:scale-[0.97]",
variant === "ghost" &&
  "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 active:scale-[0.97]",
```

**Important — check whether plan 003 has already run in this worktree.** `active:scale-[0.97]` requires `transform` to be in the element's `transition-property` list, or the scale will snap instead of animating over the button's existing `duration-150` (which already sits inside AUDIT.md's 100-160ms button-press-feedback budget, so no duration change is needed — only make sure `transform` transitions at all):

- If `components/ui/button.tsx` line 19 still reads `transition-all duration-150` (plan 003 not yet applied), no further change is needed — `transition-all` already covers `transform`.
- If plan 003 has already run and line 19 now reads `transition-[color,background-color,box-shadow,filter,opacity] duration-150`, add `transform` to that bracketed list so it becomes `transition-[color,background-color,box-shadow,filter,opacity,transform] duration-150`.

```tsx
// components/ui/stat-card.tsx — target
<Card
  onClick={onClick}
  className={cn(
    "overflow-hidden p-3 sm:p-4",
    center && "text-center",
    onClick && "cursor-pointer transition duration-150 hover:border-neutral-300 active:scale-[0.97]",
    active && "border-accent bg-accent-soft",
    className,
  )}
>
```

Here `transition-colors` is widened to the bare `transition` utility (Tailwind's default transitionable-property list already includes `transform` alongside `color`/`background-color`/`border-color`/`opacity`/`box-shadow` — this is a broader default set, not `transition-all`, and is the standard idiomatic way to transition a `:hover` color change plus an `:active` transform together) with an explicit `duration-150` added (matching AUDIT.md's button-press budget; `StatCard` had no explicit duration before, relying on Tailwind's default 150ms, so this makes the existing implicit value explicit rather than changing it).

## Repo conventions to follow

- `cn()` remains the className-merging helper; only string literals inside it change.
- Tailwind's arbitrary-value `scale-[0.97]` syntax matches the numeric-in-brackets convention already used elsewhere in this plan set (e.g. plan 005's `[@media(...)]:` variants).

## Steps

1. Open `components/ui/button.tsx`. On the `variant === "primary"` block (around line 28), change `"hover:brightness-95 active:brightness-90"` to `"hover:brightness-95 active:brightness-90 active:scale-[0.97]"`.
2. On the `variant === "outline"` block (around line 31), append ` active:scale-[0.97]` to the end of the existing class string.
3. On the `variant === "ghost"` block (around line 33), append ` active:scale-[0.97]` to the end of the existing class string.
4. Check line 19 of the same file. If it reads `transition-all duration-150`, leave it as is. If it reads `transition-[color,background-color,box-shadow,filter,opacity] duration-150` (plan 003 already applied), change it to `transition-[color,background-color,box-shadow,filter,opacity,transform] duration-150`.
5. Open `components/ui/stat-card.tsx`. On line 69, replace:
   ```tsx
   onClick && "cursor-pointer transition-colors hover:border-neutral-300",
   ```
   with:
   ```tsx
   onClick && "cursor-pointer transition duration-150 hover:border-neutral-300 active:scale-[0.97]",
   ```

## Boundaries

- Do NOT add `active:scale` to a `StatCard` instance that has no `onClick` — the scale class is already conditional on `onClick &&`, keep it that way; non-clickable stat cards must not gain any new hover/active styling.
- Do NOT touch `Card` (`components/ui/card.tsx`) itself — only `StatCard`'s own className composition.
- Do NOT touch `components/marketing/ui/marketing-button.tsx` — the marketing landing's button was already audited and fixed separately; it's a different component.
- If any of the cited lines/blocks don't match what's shown above (drift since commit `5e82fe8`, accounting for the plan-003-already-applied variant explicitly called out above), STOP and report instead of guessing.

## Verification

- **Mechanical**: `npx tsc --noEmit` — expect no errors (className-only changes).
- **Feel check**: run `npm run dev`.
  - Click (mouse-down and hold) a primary, outline, and ghost `Button` on any page (e.g. a form's submit/cancel buttons) — confirm all three now visibly shrink slightly (~97%) while held, and spring back on release, in addition to primary's existing brightness dim.
  - Click and hold a clickable `StatCard` filter (e.g. Reparaciones pipeline cards, or Cajas' medio-de-pago `StatCard`s) — confirm it now shrinks slightly while held.
  - Confirm the scale transition is smooth (not an instant snap) — if it snaps, re-check step 4 above (the `transform` property must be in the transition list).
  - Confirm a non-clickable `StatCard` (one with no `onClick`, e.g. a plain dashboard KPI) shows no hover/active effect at all — unchanged from before.
- **Done when**: all three `Button` variants and clickable `StatCard`s show a smooth, subtle press-down scale on `:active`, and `tsc --noEmit` passes.
