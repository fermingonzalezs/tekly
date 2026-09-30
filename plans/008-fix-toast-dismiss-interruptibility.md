# 008 — Fix toast dismiss keyframe-restart and animate the overflow (5th toast) case

- **Status**: DONE
- **Commit**: 5e82fe8
- **Severity**: MEDIUM
- **Category**: Interruptibility
- **Estimated scope**: 1 file, restructured into two components

## Problem

```tsx
// components/notifications/toaster.tsx:1-110 — current (full file)
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ShoppingCart,
  Wrench,
  PackageX,
  CalendarClock,
  Trash2,
  X,
} from "lucide-react";
import { describe, type AppEvent, type ToastView } from "@/lib/realtime";
import { useRealtime } from "@/components/notifications/realtime-provider";
import { cn } from "@/lib/utils";

type Toast = ToastView & { id: number; leaving?: boolean };

const ICONS = {
  sale: ShoppingCart,
  wrench: Wrench,
  package: PackageX,
  calendar: CalendarClock,
  check: Check,
  trash: Trash2,
} as const;

const LIFE_MS = 5000;

export function Toaster({ esAdmin }: { esAdmin: boolean }) {
  const { subscribe } = useRealtime();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  function dismiss(id: number) {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 200);
  }

  useEffect(() => {
    const off = subscribe((e: AppEvent) => {
      const view = describe(e);
      if (view.adminOnly && !esAdmin) return;
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, ...view }].slice(-4));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), LIFE_MS),
      );
    });
    return () => {
      off();
      timers.current.forEach(clearTimeout);
    };
  }, [subscribe, esAdmin]);

  return (
    <div className="pointer-events-none fixed right-6 top-20 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-3">
      {toasts.map((t) => {
        const Icon = ICONS[t.icon];
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-lg shadow-neutral-900/5",
              t.leaving ? "animate-toast-out" : "animate-toast-in",
            )}
          >
            <div
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                t.tone === "warning"
                  ? "bg-amber-50 text-amber-600"
                  : "bg-blue-50 text-accent",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium leading-snug text-neutral-900">
                {t.title}
              </p>
              <p className="mt-0.5 text-[13px] font-semibold text-neutral-500">
                {t.detail}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full",
                  t.tone === "warning"
                    ? "bg-amber-100 text-amber-600"
                    : "bg-emerald-100 text-emerald-600",
                )}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <button
                onClick={() => dismiss(t.id)}
                className="text-neutral-300 hover:text-neutral-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

Two bugs, both from the same root cause:

1. **Keyframe restart**: `dismiss()` swaps `animate-toast-in` → `animate-toast-out`, both `@keyframes`-based Tailwind `animation` utilities. Per AUDIT.md category 4: "CSS transitions retarget from the current state mid-animation; keyframes restart from zero." `toast-out`'s keyframes always start from its hardcoded `from: { opacity: 1, transform: translateX(0) scale(1) }` — so dismissing a toast that's still mid-entrance snaps it back to fully-visible before playing the exit, instead of smoothly reversing from wherever it currently is.
2. **Silent overflow**: `setToasts((t) => [...t, { id, ...view }].slice(-4))` — when a 5th toast arrives, the oldest is sliced out of the array directly, bypassing `dismiss()` entirely. It disappears on the very next render with no `leaving` state and no exit animation at all, unlike every other dismissal path in this same file.

## Target

Replace the keyframe-based entrance/exit with a CSS **transition** driven by local component state (mirrors the `data-mounted`-after-`useEffect` pattern AUDIT.md prescribes as the fallback for animating an entrance without `@starting-style`), and route the overflow case through the same `leaving` mechanism as every other dismissal.

```tsx
// components/notifications/toaster.tsx — target (full file)
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ShoppingCart,
  Wrench,
  PackageX,
  CalendarClock,
  Trash2,
  X,
} from "lucide-react";
import { describe, type AppEvent, type ToastView } from "@/lib/realtime";
import { useRealtime } from "@/components/notifications/realtime-provider";
import { cn } from "@/lib/utils";

type Toast = ToastView & { id: number; leaving?: boolean };

const ICONS = {
  sale: ShoppingCart,
  wrench: Wrench,
  package: PackageX,
  calendar: CalendarClock,
  check: Check,
  trash: Trash2,
} as const;

const LIFE_MS = 5000;
const MAX_VISIBLE = 4;

function ToastCard({
  t,
  onDismiss,
  onLeft,
}: {
  t: Toast;
  onDismiss: (id: number) => void;
  onLeft: (id: number) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const Icon = ICONS[t.icon];
  const visible = mounted && !t.leaving;

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-lg shadow-neutral-900/5 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
        visible
          ? "translate-x-0 scale-100 opacity-100"
          : "translate-x-6 scale-[0.96] opacity-0",
      )}
      onTransitionEnd={(e) => {
        if (e.propertyName === "opacity" && t.leaving) onLeft(t.id);
      }}
    >
      <div
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
          t.tone === "warning"
            ? "bg-amber-50 text-amber-600"
            : "bg-blue-50 text-accent",
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-medium leading-snug text-neutral-900">
          {t.title}
        </p>
        <p className="mt-0.5 text-[13px] font-semibold text-neutral-500">
          {t.detail}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "grid h-5 w-5 place-items-center rounded-full",
            t.tone === "warning"
              ? "bg-amber-100 text-amber-600"
              : "bg-emerald-100 text-emerald-600",
          )}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
        <button
          onClick={() => onDismiss(t.id)}
          className="text-neutral-300 hover:text-neutral-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Toaster({ esAdmin }: { esAdmin: boolean }) {
  const { subscribe } = useRealtime();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  function dismiss(id: number) {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
  }

  function remove(id: number) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  useEffect(() => {
    const off = subscribe((e: AppEvent) => {
      const view = describe(e);
      if (view.adminOnly && !esAdmin) return;
      const id = Date.now() + Math.random();
      setToasts((t) => {
        const next = [...t, { id, ...view }];
        // El/los más viejos por encima de MAX_VISIBLE arrancan su salida
        // igual que un dismiss normal, en vez de desaparecer de un frame
        // al otro.
        const overflow = Math.max(0, next.length - MAX_VISIBLE);
        return next.map((toast, i) =>
          i < overflow ? { ...toast, leaving: true } : toast,
        );
      });
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), LIFE_MS),
      );
    });
    return () => {
      off();
      timers.current.forEach(clearTimeout);
    };
  }, [subscribe, esAdmin]);

  return (
    <div className="pointer-events-none fixed right-6 top-20 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-3">
      {toasts.map((t) => (
        <ToastCard key={t.id} t={t} onDismiss={dismiss} onLeft={remove} />
      ))}
    </div>
  );
}
```

Key mechanics:
- `ToastCard` starts with `mounted=false` (initial render matches the "hidden" state), flips to `true` one animation frame later — this is the `data-mounted`-after-mount pattern from AUDIT.md, needed because there's no server-rendered "entering" state to transition from otherwise.
- The className swap (`visible ? "...100" : "...0"`) is driven by a plain `transition-[opacity,transform]` — a **transition**, not `@keyframes** — so calling `onDismiss` mid-entrance now correctly retargets from whatever the current computed opacity/transform is, instead of snapping to a hardcoded start state.
- `remove()` (the actual array filter) now only fires from `onTransitionEnd`, once the exit has genuinely finished on screen — replacing the old fixed `setTimeout(..., 200)` guess with the real DOM event.
- The 5th-toast overflow case now marks the oldest toast(s) `leaving: true` inside the same `setToasts` update that adds the new one, instead of slicing them out of the array — they now play the exact same exit animation as a manual or timed dismiss.

## Repo conventions to follow

- `cn()` from `@/lib/utils` remains the className-merging helper, used exactly as before.
- The `animate-toast-in`/`animate-toast-out` Tailwind keyframe utilities in `tailwind.config.ts` are left untouched by this plan (plan 004 already fixes `toast-out`'s easing) — they simply become unused by `toaster.tsx` after this change. Do not delete them from `tailwind.config.ts`; leave them in case anything else references them.
- Tailwind's arbitrary-value syntax (`ease-[cubic-bezier(...)]`, `transition-[opacity,transform]`) is already used elsewhere in this plan set (see plan 003) — consistent usage, not a new pattern.

## Steps

1. Open `components/notifications/toaster.tsx`.
2. Replace the entire file contents with the Target version above.
3. Confirm the import list is unchanged (still imports `useEffect`, `useRef`, `useState` from React, the same lucide icons, `describe`/`AppEvent`/`ToastView` from `@/lib/realtime`, `useRealtime`, and `cn`).

## Boundaries

- Do NOT change `LIFE_MS` (5000ms) — only `MAX_VISIBLE` is a new constant (4, matching the previous hardcoded `.slice(-4)`).
- Do NOT change `lib/realtime.ts` or `useRealtime()` — this plan only touches how `Toaster` renders and dismisses, not the event subscription contract.
- Do NOT re-add `animate-toast-in`/`animate-toast-out` classes anywhere in this file — the whole point of this fix is replacing keyframe-based animation with a transition here.
- If the current file doesn't match the "current" snippet above exactly (drift since commit `5e82fe8`, e.g. if plan 004 was already applied and changed something else nearby), STOP and report instead of guessing — the only expected prior change from plan 004 is inside `tailwind.config.ts`, not this file.

## Verification

- **Mechanical**: `npx tsc --noEmit` — expect no errors (the `ToastCard` sub-component is fully typed, `onTransitionEnd` is a standard React DOM event handler).
- **Feel check**: run `npm run dev`, trigger toasts (perform an action that fires a realtime event — see `lib/realtime.ts` for what triggers one, or open two tabs on the same org and act in one).
  - Trigger a toast and immediately (within ~100ms, before its entrance finishes) dismiss it via its close (X) button — confirm it smoothly reverses from its current position/opacity, with no visible snap back to "fully visible" first.
  - Trigger 5 toasts in quick succession — confirm the oldest (5th-from-newest) now visibly animates out (slide+fade) instead of vanishing instantly, and no more than 4 are ever visible at once.
  - Let a toast auto-dismiss after its normal 5-second life — confirm it still animates out exactly as before.
  - In DevTools' Animations panel, set playback to 10% during a dismiss and confirm the opacity/transform genuinely retarget smoothly from the interrupted position when dismissed mid-entrance.
- **Done when**: `tsc --noEmit` passes, dismissing a toast mid-entrance never snaps, and a 5th toast's overflow removal plays the same visible exit as any other dismissal.
