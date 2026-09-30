# 006 — Give Dialog and MobileNavDrawer a real exit animation and correct entrance physicality

- **Status**: DONE
- **Commit**: 5e82fe8
- **Severity**: MEDIUM
- **Category**: Physicality & origin / Interruptibility / Accessibility
- **Estimated scope**: 3 files (`tailwind.config.ts`, `components/ui/dialog.tsx`, `components/mobile-nav-drawer.tsx`) + 1 CSS addition (`app/globals.css`)

## Problem

`Dialog` (used by every form/detail view in the app) and `MobileNavDrawer` (the mobile nav, opened constantly below the `md` breakpoint) both animate in but hard-unmount on close with **no exit animation at all**:

```tsx
// components/ui/dialog.tsx:54 — current
if (!open) return null;
```

```tsx
// components/mobile-nav-drawer.tsx:32 — current
if (!open) return null;
```

Separately, `Dialog`'s panel reuses the toast's directional slide token for a centered surface that has no trigger to slide in from:

```tsx
// components/ui/dialog.tsx:71 — current
"animate-toast-in relative my-8 w-full rounded-2xl border bg-white shadow-2xl",
```

(`toast-in` keyframes: `from: { opacity: 0, transform: "translateX(24px) scale(0.96)" }` — a 24px horizontal slide implies a spatial origin to the modal's right that doesn't exist for a centered dialog.)

Both components' close (X) buttons also change color/background on hover with no transition:

```tsx
// components/ui/dialog.tsx:113-120 — current
<button
  onClick={onClose}
  className={cn(
    "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
    accent
      ? "text-white/70 hover:bg-white/10 hover:text-white"
      : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600",
  )}
>
```

```tsx
// components/mobile-nav-drawer.tsx:47-52 — current
<button
  onClick={onClose}
  aria-label="Cerrar menú"
  className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
>
```

And neither component's real transform-based movement (`translateX`/`scale` in Dialog, `translateX(-100%)` drawer slide + backdrop fade in MobileNavDrawer) has any `prefers-reduced-motion` handling — a repo-wide, documented gap (CLAUDE.md: "No hay manejo de prefers-reduced-motion todavía en ningún componente ... pendiente"), and these are two of the highest-frequency real-movement surfaces in the app.

## Target

### 1. New keyframes/animations in `tailwind.config.ts`

Add a dedicated `modal-in`/`modal-out` pair (scale + opacity only, no translate — correct for a centered surface) and a `drawer-out`/`fade-out` pair (the missing exit counterparts to the existing `drawer-in`/`fade-in`):

```ts
// tailwind.config.ts — add inside theme.extend.keyframes, alongside the existing entries
"modal-in": {
  from: { opacity: "0", transform: "scale(0.96)" },
  to: { opacity: "1", transform: "scale(1)" },
},
"modal-out": {
  from: { opacity: "1", transform: "scale(1)" },
  to: { opacity: "0", transform: "scale(0.96)" },
},
"drawer-out": {
  from: { transform: "translateX(0)" },
  to: { transform: "translateX(-100%)" },
},
"fade-out": {
  from: { opacity: "1" },
  to: { opacity: "0" },
},
```

```ts
// tailwind.config.ts — add inside theme.extend.animation, alongside the existing entries
"modal-in": "modal-in 0.22s cubic-bezier(0.23, 1, 0.32, 1)",
"modal-out": "modal-out 0.2s cubic-bezier(0.23, 1, 0.32, 1) forwards",
"drawer-out": "drawer-out 0.2s cubic-bezier(0.23, 1, 0.32, 1) forwards",
"fade-out": "fade-out 0.18s cubic-bezier(0.23, 1, 0.32, 1) forwards",
```

Both durations (220ms in / 200ms out) sit inside AUDIT.md's 200-500ms modal/drawer budget. The strong ease-out curve (`cubic-bezier(0.23, 1, 0.32, 1)`) is the same one used to fix `toast-out` in plan 004 — reuse it here too so every exit in the app shares one curve (this plan does not depend on plan 004 having run first; if plan 004 has already added lines near `toast-out`, insert this plan's new entries as additional sibling lines in the same objects, not a replacement).

### 2. `components/ui/dialog.tsx` — exit-before-unmount + correct token + button transition

```tsx
// target
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

let openDialogs = 0;

export function lockScroll() {
  openDialogs += 1;
  if (openDialogs === 1) document.body.style.overflow = "hidden";
}

export function unlockScroll() {
  openDialogs = Math.max(0, openDialogs - 1);
  if (openDialogs === 0) document.body.style.overflow = "";
}

const EXIT_MS = 200;

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  accent = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg" | "xl" | "2xl";
  accent?: boolean;
}) {
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);

  // Mismo patrón que el `leaving` + setTimeout de Toaster (components/notifications/toaster.tsx):
  // seguimos montados EXIT_MS después de que `open` pasa a false para poder
  // reproducir la animación de salida antes de desmontar.
  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      return;
    }
    if (!rendered) return;
    setClosing(true);
    const t = setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, EXIT_MS);
    return () => clearTimeout(t);
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    lockScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlockScroll();
    };
  }, [open, onClose]);

  if (!rendered) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            closing ? "animate-modal-out" : "animate-modal-in",
            "relative my-8 w-full rounded-2xl border bg-white shadow-2xl",
            accent ? "border-accent" : "border-neutral-200",
            size === "2xl"
              ? "max-w-4xl"
              : size === "xl"
                ? "max-w-3xl"
                : size === "lg"
                  ? "max-w-2xl"
                  : "max-w-md",
          )}
        >
          <div
            className={cn(
              "flex items-start justify-between gap-4 rounded-t-2xl border-b px-4 py-4 sm:px-5",
              accent
                ? "border-table-header bg-table-header text-white"
                : "border-neutral-100",
            )}
          >
            <div>
              <h2
                className={cn(
                  "text-base font-semibold uppercase tracking-wide",
                  accent ? "text-white" : "text-neutral-900",
                )}
              >
                {title}
              </h2>
              {accent && description && (
                <div className="mt-1.5 mb-1.5 h-px w-full bg-white/20" />
              )}
              {description && (
                <p
                  className={cn(
                    "text-sm",
                    accent ? "text-white/70" : "mt-0.5 text-neutral-400",
                  )}
                >
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
                accent
                  ? "text-white/70 hover:bg-white/10 hover:text-white"
                  : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600",
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className={cn("px-4 py-4 sm:px-5", !footer && "rounded-b-2xl")}>
            {children}
          </div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-neutral-100 px-4 py-3.5 sm:px-5">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

The only behavioral changes versus current: (a) `rendered`/`closing` state replaces the direct `if (!open) return null`, (b) the panel's className swaps `animate-toast-in` for `closing ? "animate-modal-out" : "animate-modal-in"`, (c) `transition-colors` added to the close button. Everything else (props, markup structure, scroll-lock, Escape handling) is byte-for-byte unchanged.

### 3. `components/mobile-nav-drawer.tsx` — same exit-before-unmount pattern + button transition

```tsx
// target
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Smartphone, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/nav";

const EXIT_MS = 200;

export function MobileNavDrawer({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
}) {
  const pathname = usePathname();
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      return;
    }
    if (!rendered) return;
    setClosing(true);
    const t = setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, EXIT_MS);
    return () => clearTimeout(t);
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!rendered) return null;

  return (
    <div
      className={cn(
        closing ? "animate-fade-out" : "animate-fade-in",
        "fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-[2px] md:hidden",
      )}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          closing ? "animate-drawer-out" : "animate-drawer-in",
          "flex h-full w-[80%] max-w-72 flex-col border-r border-neutral-200 bg-white shadow-2xl",
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-neutral-200 px-5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-white">
            <Smartphone className="h-5 w-5" />
          </div>
          <span className="font-grotesk text-sm font-semibold tracking-wide text-neutral-900">TEKLY</span>
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-neutral-600 hover:bg-neutral-100",
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
```

### 4. Reduced-motion branch in `app/globals.css`

Insert this new block after the `input[type="number"]` rules (around line 182) and before the `@media print` block:

```css
/* Movimiento real (Dialog, MobileNavDrawer) baja a un simple fundido de
   opacidad bajo prefers-reduced-motion -- se mantiene el feedback, se
   descarta el movimiento (scale/translate). Ver CLAUDE.md "Motion". */
@media (prefers-reduced-motion: reduce) {
  .animate-modal-in,
  .animate-drawer-in {
    animation: fade-in 0.18s cubic-bezier(0.23, 1, 0.32, 1);
  }
  .animate-modal-out,
  .animate-drawer-out {
    animation: fade-out 0.18s cubic-bezier(0.23, 1, 0.32, 1) forwards;
  }
}
```

## Repo conventions to follow

- The `rendered`/`closing`-then-delayed-unmount pattern already exists in this codebase in `components/notifications/toaster.tsx:35-38` (`dismiss()` sets `leaving: true`, then `setTimeout(() => remove, 200)`) — this plan applies the exact same idea to `Dialog` and `MobileNavDrawer`, just via local component state instead of an array of items.
- All animation names/durations/easings continue to live in `tailwind.config.ts`'s `keyframes`/`animation` objects — no CSS custom properties or new files.
- `cn()` from `@/lib/utils` is the established className-merging helper used throughout this codebase — use it for the `closing ? "...-out" : "...-in"` swap, matching how `toaster.tsx:66` already does `t.leaving ? "animate-toast-out" : "animate-toast-in"`.

## Steps

1. Open `tailwind.config.ts`. Inside `theme.extend.keyframes`, add the four new keyframe entries from the Target section (`modal-in`, `modal-out`, `drawer-out`, `fade-out`) as siblings to the existing ones (order doesn't matter, but keep them grouped together for readability).
2. Inside `theme.extend.animation` (same file), add the four corresponding animation entries from the Target section.
3. Replace the full contents of `components/ui/dialog.tsx` with the Target version in section 2 above. Confirm the only prop/behavior changes are: added `rendered`/`closing` state, the `if (!rendered) return null` guard, the panel's animation class swap, and `transition-colors` on the close button.
4. Replace the full contents of `components/mobile-nav-drawer.tsx` with the Target version in section 3 above. Same confirmation as step 3.
5. Open `app/globals.css`. Insert the reduced-motion block from section 4 above, positioned after the `input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { ... }` rule (ends around line 182) and before the `@media print {` block (starts around line 196).

## Boundaries

- Do NOT change `Dialog`'s or `MobileNavDrawer`'s public props/API — `open`, `onClose`, `title`, `description`, `children`, `footer`, `size`, `accent` (Dialog) and `open`, `onClose`, `items` (MobileNavDrawer) are unchanged; every existing call site keeps working with no changes.
- Do NOT touch `lockScroll`/`unlockScroll` logic beyond what's shown (the open-dialog counter mechanism is unrelated to this fix and must keep working exactly as before, including dialog-over-dialog stacking).
- Do NOT add exit animation to `components/notifications/bell.tsx`, `components/auth/user-menu.tsx`, `components/command-palette/command-palette.tsx`, or `components/topnav.tsx`'s category dropdown — those are separate, un-selected findings (see plan 007) and out of scope here.
- Do NOT touch `components/notifications/toaster.tsx` — it already has its own working exit pattern (fixed separately in plan 004 for easing only).
- If any of the three target files' current content doesn't match what's quoted above (drift since commit `5e82fe8`), STOP and report which lines differ instead of improvising a merge.

## Verification

- **Mechanical**: `npx tsc --noEmit` — expect no errors (state additions are locally typed, no prop signature changes). Restart `npm run dev` after the `tailwind.config.ts` edit.
- **Feel check**: run `npm run dev`.
  - Open any form dialog (e.g. Inventario → "Agregar equipo"). Confirm it scales+fades in from ~96% (no directional slide). Close it and confirm it now visibly scales+fades back out before disappearing, instead of vanishing instantly.
  - Resize to mobile width (or use DevTools device emulation), open the hamburger menu. Confirm the drawer slides in from the left and the backdrop fades in; close it and confirm both now animate out (drawer slides back left, backdrop fades out) instead of vanishing instantly.
  - Hover the close (X) button on both a Dialog and the drawer — confirm the color/background now transitions smoothly instead of snapping.
  - In DevTools' Rendering panel, enable "Emulate CSS media feature prefers-reduced-motion: reduce", then repeat both open/close checks: confirm the dialog and drawer still fade in/out (opacity), but no longer scale or slide.
  - Rapidly click to reopen a dialog while it's still mid-exit (click close, then immediately reopen before ~200ms passes) — confirm it doesn't glitch (snap to a broken intermediate state); it should cleanly restart into its entrance animation.
- **Done when**: both components pass `tsc --noEmit`, both show a real exit animation before unmounting, the Dialog panel no longer uses `animate-toast-in`, both close buttons transition color smoothly, and reduced-motion emulation shows fade-only motion for both.
