"use client";

import { useState } from "react";
import { MailFrame } from "./mail-frame";

const ANCHOS = { desktop: 640, movil: 375 } as const;

export function MailsVista({ mails }: { mails: { file: string; label: string; html: string }[] }) {
  const [vista, setVista] = useState<keyof typeof ANCHOS>("desktop");
  return (
    <>
      <div className="flex gap-2" role="group" aria-label="Ancho de la vista previa">
        {(["desktop", "movil"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={vista === v}
            onClick={() => setVista(v)}
            className={`h-9 rounded-full border px-4 text-sm font-semibold transition-colors ${
              vista === v
                ? "border-accent bg-accent text-white"
                : "border-neutral-900/10 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {v === "desktop" ? "Escritorio (640)" : "Móvil (375)"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-start gap-8">
        {mails.map((m) => (
          <section key={m.file} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{m.label}</h2>
            <MailFrame key={vista} title={m.label} html={m.html} width={ANCHOS[vista]} />
          </section>
        ))}
      </div>
    </>
  );
}
