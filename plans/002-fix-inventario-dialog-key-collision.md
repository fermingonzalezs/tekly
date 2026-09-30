# 002 — Fix duplicate dialog `key` fallback in Inventario

- **Status**: DONE
- **Commit**: 5e82fe8
- **Severity**: HIGH
- **Category**: Interruptibility (bug regression)
- **Estimated scope**: 1 file, 2-line change

## Problem

`RecuentoEquiposModalDialog` and `RecuentoModalDialog` are two sibling, unrelated dialogs rendered side by side in Inventario. They currently share the same literal fallback key, `"none"`, whenever `recuentoModalTipo` doesn't match their own trigger condition — which is the resting state (`recuentoModalTipo` defaults to `null`), so **both dialogs resolve to `key="none"` simultaneously on every normal render.**

```tsx
// app/(app)/inventario/inventario-client.tsx:1549-1562 — current
{/* Recuento -- siempre en un modal aparte, la tabla no cambia de forma */}
<RecuentoEquiposModalDialog
  key={recuentoModalTipo === "equipos" ? "equipos" : "none"}
  open={recuentoModalTipo === "equipos"}
  items={equipos
    .filter((e) => e.estado !== "vendido")
    .map((e) => ({
      id: e.id,
      nombre: `${e.modelo} ${e.almacenamiento} · ${e.color} · ${e.imei}`,
    }))}
  onClose={() => setRecuentoModalTipo(null)}
  onSubmit={async (draft, comentarios, comentarioGeneral) => {
    await crearRecuentoEquiposAction(draft, comentarios, comentarioGeneral);
    setRecuentoModalTipo(null);
  }}
/>
<RecuentoModalDialog
  key={
    recuentoModalTipo === "repuestos" || recuentoModalTipo === "otros"
      ? recuentoModalTipo
      : "none"
  }
  tipo={recuentoModalTipo === "otros" ? "otros" : "repuestos"}
  open={recuentoModalTipo === "repuestos" || recuentoModalTipo === "otros"}
  ...
```

This is a **regression of a bug already documented and fixed once in this exact repo**. CLAUDE.md's "Errores de UI/accesibilidad que ya nos mordieron" section states the rule explicitly: the `key={condición ? id : "fallback"}` pattern used to reset a `Dialog` on reopen "necesita un `fallback` distinto por cada dialog del componente, nunca el mismo literal (`"none"`) compartido — cuando dos o más dialogs hermanos están cerrados a la vez ... React tira `Encountered two children with the same key`." That is exactly the state these two dialogs are in at rest.

## Target

Give each dialog its own distinct, prefixed fallback string, per the exact rule CLAUDE.md prescribes ("Prefijar con el nombre del dialog").

```tsx
// target
<RecuentoEquiposModalDialog
  key={recuentoModalTipo === "equipos" ? "equipos" : "recuento-equipos-none"}
  open={recuentoModalTipo === "equipos"}
  ...
/>
<RecuentoModalDialog
  key={
    recuentoModalTipo === "repuestos" || recuentoModalTipo === "otros"
      ? recuentoModalTipo
      : "recuento-modal-none"
  }
  ...
```

## Repo conventions to follow

- CLAUDE.md documents the exact convention to use: prefix the fallback literal with the dialog's own name (its example: `"recibo-none"`, `"entregar-none"`, `"equipo-none"`) instead of a bare `"none"` shared across siblings.
- Do not change the `open`/trigger-condition logic — only the fallback string in the `key` expression.

## Steps

1. Open `app/(app)/inventario/inventario-client.tsx`. Locate the `<RecuentoEquiposModalDialog ... key={...} ... />` block (around line 1550). Change:
   ```tsx
   key={recuentoModalTipo === "equipos" ? "equipos" : "none"}
   ```
   to:
   ```tsx
   key={recuentoModalTipo === "equipos" ? "equipos" : "recuento-equipos-none"}
   ```
2. Immediately below it, locate the `<RecuentoModalDialog ... key={...} ... />` block (around lines 1565-1569). Change:
   ```tsx
   key={
     recuentoModalTipo === "repuestos" || recuentoModalTipo === "otros"
       ? recuentoModalTipo
       : "none"
   }
   ```
   to:
   ```tsx
   key={
     recuentoModalTipo === "repuestos" || recuentoModalTipo === "otros"
       ? recuentoModalTipo
       : "recuento-modal-none"
   }
   ```
3. Search the rest of `inventario-client.tsx` for any other dialog using a bare `"none"` fallback (grep for `: "none"` in the file) — if found, apply the same prefixing fix; if none found, no further changes are needed.

## Boundaries

- Do NOT change `open={...}`, `items={...}`, `onClose`, `onSubmit`, or any other prop on either dialog — only the `key` fallback string.
- Do NOT touch any other dialog in this file unless step 3's grep finds another instance of the identical bare-`"none"` pattern.
- Do NOT touch any other section's client file — this bug pattern was only confirmed in Inventario.
- If the two dialog blocks don't match the snippets above exactly (drift since commit `5e82fe8`), STOP and report instead of guessing which lines to change.

## Verification

- **Mechanical**: `npx tsc --noEmit` — expect no errors (string literal change only).
- **Feel check**: run `npm run dev`, open Inventario, open the browser DevTools console, and confirm:
  - No "Encountered two children with the same key" (or similar duplicate-key) warning appears in the console on page load or on navigating to the Otros/Repuestos tab.
  - Open "Recuento" for Equipos, close it, then open "Recuento" for Repuestos (or Otros) — each dialog still resets its internal state correctly on reopen (the whole point of the `key` trick), with no leftover state from the previous dialog.
- **Done when**: the console shows no duplicate-key warning anywhere in Inventario, and both Recuento dialogs still open/close/reset correctly.
