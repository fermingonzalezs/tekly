"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LEGAL_BORRADOR } from "@/lib/legal";

const CLAVE = "tekly:cookies-aviso";

/** Aviso informativo de cookies (plan 012). Tekly solo usa cookies
 * estrictamente necesarias, así que no hay "rechazar": se avisa una vez y se
 * recuerda en `localStorage`. Si se suma analytics/marketing, esto pasa a ser
 * un banner de consentimiento (ver plan 012). Arranca oculto para no romper
 * la hidratación; sin `localStorage` (modo privado) se muestra en cada visita. */
export function AvisoCookies() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(CLAVE) !== "1") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  // Linkea a /cookies: no se muestra mientras esa página sea borrador.
  if (LEGAL_BORRADOR || !visible) return null;

  function cerrar() {
    try {
      localStorage.setItem(CLAVE, "1");
    } catch {
      /* sin storage: vuelve a mostrarse, no pasa nada */
    }
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border border-neutral-900/10 bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:gap-4"
    >
      <p className="text-[13px] leading-snug text-neutral-600">
        Usamos solo cookies necesarias para que el sitio funcione y sea seguro.{" "}
        <Link href="/cookies" className="font-medium text-accent underline">
          Más info
        </Link>
      </p>
      <Button size="sm" variant="outline" onClick={cerrar} className="shrink-0">
        Entendido
      </Button>
    </div>
  );
}
