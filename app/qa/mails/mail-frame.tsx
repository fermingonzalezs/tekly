"use client";

import { useRef, useState } from "react";

/** Iframe de un mail a su alto completo (sin scroll interno): mide el
 * documento al cargar y cuando cambia el ancho. */
export function MailFrame({ title, html, width }: { title: string; html: string; width: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [alto, setAlto] = useState(900);

  function medir() {
    const doc = ref.current?.contentDocument;
    if (doc) setAlto(Math.ceil(doc.documentElement.scrollHeight));
  }

  return (
    <iframe
      ref={ref}
      title={title}
      srcDoc={html}
      onLoad={medir}
      scrolling="no"
      style={{ width, height: alto }}
      className="max-w-full rounded-xl border border-neutral-200 bg-white shadow-sm"
    />
  );
}
