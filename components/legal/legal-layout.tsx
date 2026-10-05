import Link from "next/link";
import { notFound } from "next/navigation";
import { TeklyLogo } from "@/components/brand/tekly-logo";
import { AvisoCookies } from "@/components/legal/aviso-cookies";
import { LEGAL_ACTUALIZADO, LEGAL_BORRADOR, TERMINOS_VERSION } from "@/lib/legal";

/** Marco común de las páginas legales (plan 012): encabezado con el logo,
 * aviso de borrador (mientras `LEGAL_BORRADOR`), versión/fecha y links
 * cruzados. Las páginas son públicas, con o sin sesión. */

const LINKS = [
  { href: "/terminos", label: "Términos y condiciones" },
  { href: "/privacidad", label: "Política de privacidad" },
  { href: "/cookies", label: "Política de cookies" },
];

export function LegalLayout({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  // Borrador: visible solo en desarrollo, para revisar el texto; en producción
  // no existe hasta que se completen los datos y se apague `LEGAL_BORRADOR`.
  if (LEGAL_BORRADOR && process.env.NODE_ENV === "production") notFound();

  return (
    <div className="min-h-screen bg-[#f7f7fa] text-neutral-900">
      <header className="border-b border-neutral-900/[.06] bg-white/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Tekly">
            <TeklyLogo variante="horizontal" altura={30} alt="" />
          </Link>
          <Link href="/" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6">
        {LEGAL_BORRADOR && (
          <p
            role="note"
            className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <strong className="font-semibold">Borrador.</strong> Este texto está
            pendiente de revisión legal y de completar los datos entre corchetes
            [ ]. No es la versión definitiva.
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight">{titulo}</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Última actualización: {LEGAL_ACTUALIZADO} · versión {TERMINOS_VERSION}
        </p>
        <div className="mt-8 space-y-8">{children}</div>
      </main>

      <footer className="border-t border-neutral-900/[.06] py-8">
        <nav className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 px-4 text-sm sm:px-6">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-neutral-600 hover:text-neutral-900">
              {l.label}
            </Link>
          ))}
        </nav>
      </footer>
      <AvisoCookies />
    </div>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-neutral-700">{children}</div>
    </section>
  );
}

export function Lista({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
