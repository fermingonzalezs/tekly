# 001 — Remove animation from the Cmd+K command palette

- **Status**: DONE
- **Commit**: 5e82fe8
- **Severity**: HIGH
- **Category**: Purpose & frequency
- **Estimated scope**: 1 file, 1-line change

## Problem

The command palette is opened by a global keyboard shortcut (`Cmd+K` / `Ctrl+K`), the app's single fastest, most power-user-facing navigation path. Its panel currently animates open with the `animate-toast-in` Tailwind utility (0.22s `cubic-bezier(0.21, 1.02, 0.73, 1)`, defined in `tailwind.config.ts`).

```tsx
// components/command-palette/command-palette.tsx:38-44 — current (keyboard trigger)
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setOpen((v) => !v);
      return;
    }
    ...
```

```tsx
// components/command-palette/command-palette.tsx:98 — current
<div className="animate-toast-in overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
```

## Target

AUDIT.md's frequency table is explicit: "100+ times/day (keyboard shortcuts, command palette toggle) → No animation. Ever." Raycast is cited as the reference implementation — it has no open/close transition. Remove the animation class entirely so the panel appears instantly the moment the shortcut fires.

```tsx
// target
<div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
```

No other markup changes. The backdrop (`fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-[2px]`, line ~91) is not itself animated today (no `animate-fade-in` on it) — leave it as is, do not add one.

## Repo conventions to follow

- Animation utilities are defined once in `tailwind.config.ts` under `keyframes`/`animation` and applied as plain Tailwind classes (`animate-toast-in`, `animate-fade-in`, etc.) — this fix simply removes a class, no new token needed.
- `components/command-palette/command-palette.tsx` itself is the only file to touch.

## Steps

1. Open `components/command-palette/command-palette.tsx`. Find the line (around line 98) that reads:
   ```tsx
   <div className="animate-toast-in overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
   ```
   Remove `animate-toast-in ` (including the trailing space) so it becomes:
   ```tsx
   <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
   ```
2. Do not touch anything else in the file — the `open` state logic, the backdrop, the input, and the results list are unaffected by this change.

## Boundaries

- Do NOT touch the backdrop div, the input, the results list, or any keyboard-handling logic in this file.
- Do NOT add a replacement animation (e.g. a faster fade) — the correct fix per AUDIT.md is zero animation, not a shorter one.
- Do NOT touch any other file.
- If line 98 does not match the snippet above exactly (drift since commit `5e82fe8`), STOP and report instead of guessing which div to edit.

## Verification

- **Mechanical**: `npx tsc --noEmit` — expect no errors (this is a className-only change).
- **Feel check**: run `npm run dev`, open the app, press `Cmd+K` (or `Ctrl+K` on non-Mac) repeatedly in quick succession and confirm:
  - The palette panel appears and disappears instantly, with no fade/scale/slide — it should feel like a toggle, not a transition.
  - The backdrop dim still appears (unchanged, no animation expected there either).
  - Typing and arrow-key navigation inside the palette still work exactly as before (unaffected by this change).
- **Done when**: the `animate-toast-in` class no longer appears anywhere in `components/command-palette/command-palette.tsx`, and `tsc --noEmit` passes.
