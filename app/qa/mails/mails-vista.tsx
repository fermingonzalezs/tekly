"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MailFrame } from "./mail-frame";

const ANCHOS = { desktop: 640, movil: 375 } as const;

type Mail = { file: string; label: string; subject: string; html: string; source: string };

/** Copia al portapapeles; si el navegador lo rechaza, cae a seleccionar un
 * <textarea> temporal. */
async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

function BotonCopiar({ texto, label }: { texto: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      variant="tonal"
      size="sm"
      icon={ok ? Check : Copy}
      onClick={async () => {
        if (await copiar(texto)) {
          setOk(true);
          setTimeout(() => setOk(false), 1800);
        }
      }}
    >
      {ok ? "Copiado" : label}
    </Button>
  );
}

export function MailsVista({ mails }: { mails: Mail[] }) {
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
            <div className="flex flex-wrap items-center gap-2" style={{ maxWidth: ANCHOS[vista] }}>
              <BotonCopiar texto={m.source} label="Copiar HTML" />
              <BotonCopiar texto={m.subject} label="Copiar asunto" />
            </div>
            <p className="text-xs text-neutral-500" style={{ maxWidth: ANCHOS[vista] }}>
              Asunto: <span className="font-medium text-neutral-700">{m.subject}</span>
            </p>
            <MailFrame key={vista} title={m.label} html={m.html} width={ANCHOS[vista]} />
          </section>
        ))}
      </div>
    </>
  );
}
