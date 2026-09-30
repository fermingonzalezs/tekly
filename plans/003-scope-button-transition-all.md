# 003 — Scope the shared Button's `transition-all` to explicit properties

- **Status**: DONE
- **Commit**: 5e82fe8
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 1 file, 1-line change

## Problem

`components/ui/button.tsx` is the one shared `Button` component used across nearly every screen in the app (forms, toolbars, dialog footers). It applies `transition-all`:

```tsx
// components/ui/button.tsx:17-23 — current
<button
  className={cn(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-bold uppercase tracking-wider transition-all duration-150",
    shape === "pill" ? "rounded-full" : "rounded-lg",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1",
    "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
    size === "sm" ? "h-8 px-3.5 text-[11px]" : "h-9 px-4 text-xs",
```

Per AUDIT.md, `transition: all` is "always a finding" because it animates every property that changes — including layout properties (`width`, `height`, `padding`) if any caller's `className` (merged in via `cn(..., className)` at the end of the class list) ever changes one of those on state change. Since `Button` is consumed everywhere with arbitrary `className` overrides, this risk is repo-wide, not local to this file.

The only properties that actually change on this component's own states are: background/text color (hover, `variant` swaps), `box-shadow` (the `disabled:shadow-none` case), `opacity` (disabled), and `filter` (the primary variant's `hover:brightness-95`/`active:brightness-90`, which are CSS `filter` changes).

## Target

Replace `transition-all` with an explicit list of the properties this component actually animates, so a future caller-supplied layout-affecting className never accidentally animates off-GPU.

```tsx
// target
"inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-bold uppercase tracking-wider transition-[color,background-color,box-shadow,filter,opacity] duration-150",
```

Tailwind's arbitrary-value syntax `transition-[color,background-color,box-shadow,filter,opacity]` compiles to a real `transition-property` list — this is a direct, minimal substitution for `transition-all`, keeping the same `duration-150` and the default Tailwind easing (this component does not currently use a custom easing token, and this plan does not introduce one — see Boundaries).

## Repo conventions to follow

- Tailwind arbitrary-value bracket syntax (`transition-[...]`) is already used elsewhere in this codebase for one-off values (e.g. `w-[80%]` in `mobile-nav-drawer.tsx`), so this is consistent with existing usage, not a new pattern.
- `components/ui/button.tsx` is short (39 lines) — this is the only line in the file that needs to change.

## Steps

1. Open `components/ui/button.tsx`. On line 19, replace:
   ```
   transition-all duration-150
   ```
   with:
   ```
   transition-[color,background-color,box-shadow,filter,opacity] duration-150
   ```
2. Do not change anything else on that line or elsewhere in the file.

## Boundaries

- Do NOT change the `duration-150` value or add an easing class — this plan only narrows which properties transition, it does not change timing.
- Do NOT touch `variant`/`size`/`shape` logic, or any other file. `components/marketing/ui/marketing-button.tsx` has its own separate `transition-all` (line 32) and is explicitly OUT of scope for this plan — the marketing landing was already audited and fixed in a separate pass.
- Do NOT touch `components/reportar-bug-fab.tsx:37` or `components/command-palette/command-palette.tsx:83` even though they have the identical `transition-all` anti-pattern on their own FAB buttons — those are separate, un-selected findings from the same audit round, not part of this plan's scope.
- If line 19 does not match the snippet above exactly (drift since commit `5e82fe8`), STOP and report instead of guessing.

## Verification

- **Mechanical**: `npx tsc --noEmit` and `npx vitest run` — expect no errors (className-only change, no logic touched).
- **Feel check**: run `npm run dev`, visit any page with buttons (e.g. `/ventas`, or `/login`), and confirm:
  - Hovering a primary button still smoothly transitions its `filter` (brightness dim).
  - Hovering an outline/ghost button still smoothly transitions its background/text color — no visible change in feel versus before the fix.
  - Disabling a button (e.g. a form submit button mid-request, if easy to trigger) still fades its opacity smoothly, not instantly.
  - In DevTools' Elements panel, inspect a rendered `<button>` and confirm the computed `transition-property` no longer includes layout properties like `width`/`height`/`padding`/`margin`.
- **Done when**: `transition-all` no longer appears in `components/ui/button.tsx`, and all three variants (`primary`, `outline`, `ghost`) still show smooth hover/active/disabled feedback identical in feel to before.
