import { describe, expect, it } from "vitest";
import { buttonClasses } from "@/components/ui/button";

/** El entorno de tests es `node` (sin DOM): no se puede montar React, así que
 * se prueba el helper puro de clases que alimenta `Button`/`ButtonLink`. La
 * obligatoriedad de `aria-label` en `IconButton` la chequea `tsc` (es un tipo
 * requerido) y se verifica con `npx tsc --noEmit`. */
describe("buttonClasses", () => {
  it("default: primary + md + pill + semibold sin mayúsculas", () => {
    const c = buttonClasses({});
    expect(c).toContain("rounded-full");
    expect(c).toContain("bg-accent");
    expect(c).toContain("font-semibold");
    expect(c).not.toContain("uppercase");
    expect(c).not.toContain("linear-gradient");
    expect(c).toContain("h-9"); // md = 36px
  });

  it("cada variante tiene su estilo propio", () => {
    expect(buttonClasses({ variant: "outline" })).toContain("bg-white/65");
    expect(buttonClasses({ variant: "tonal" })).toContain("bg-accent-soft/50");
    expect(buttonClasses({ variant: "ghost" })).toContain("hover:bg-neutral-100");
    expect(buttonClasses({ variant: "danger" })).toContain("bg-red-600");
    expect(buttonClasses({ variant: "danger-outline" })).toContain("text-red-600");
    expect(buttonClasses({ variant: "link" })).toContain("hover:underline");
    expect(buttonClasses({ variant: "inverse" })).toContain("bg-white");
  });

  it("tamaños: sm 32 · md 36 · lg 40 · xl 48", () => {
    expect(buttonClasses({ size: "sm" })).toContain("h-8");
    expect(buttonClasses({ size: "md" })).toContain("h-9");
    expect(buttonClasses({ size: "lg" })).toContain("h-10");
    expect(buttonClasses({ size: "xl" })).toContain("h-12");
  });

  it("con chip el padding derecho es más chico (el círculo queda centrado)", () => {
    const sinChip = buttonClasses({ size: "md", chip: false });
    const conChip = buttonClasses({ size: "md", chip: true });
    expect(sinChip).toContain("px-4");
    expect(conChip).toContain("pr-1");
    expect(conChip).not.toContain("px-4");
  });

  it("el variant link no tiene caja (sin padding/sombra)", () => {
    const c = buttonClasses({ variant: "link" });
    expect(c).toContain("h-auto");
    expect(c).toContain("px-0");
    expect(c).toContain("shadow-none");
  });

  it("fullOnMobile agrega w-full sm:w-auto", () => {
    expect(buttonClasses({ fullOnMobile: true })).toContain("w-full sm:w-auto");
    expect(buttonClasses({})).not.toContain("w-full sm:w-auto");
  });

  it("todos los botones comparten foco y disabled", () => {
    const c = buttonClasses({ variant: "danger" });
    expect(c).toContain("focus-visible:ring-2");
    expect(c).toContain("disabled:pointer-events-none");
    expect(c).toContain("active:scale-[0.98]");
  });

  it("respeta className extra", () => {
    expect(buttonClasses({ className: "mt-2" })).toContain("mt-2");
  });
});
