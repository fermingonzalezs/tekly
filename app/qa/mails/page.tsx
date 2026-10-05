import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { MailsVista } from "./mails-vista";

export const metadata = { title: "QA · Mails de Auth" };
export const dynamic = "force-dynamic";

const TEMPLATES = [
  { file: "confirm-signup.html", label: "Confirm signup" },
  { file: "invite.html", label: "Invite user" },
  { file: "recovery.html", label: "Reset Password" },
] as const;

const DATA: Record<string, string> = { nombre: "Fermín", organizacion: "iPhone Center" };

/** Mini-render de la sintaxis de Go templates que usan nuestros mails
 * (`{{ .X }}`, `{{ if .Data.x }}…{{ else }}…{{ end }}`) -- solo para previsualizar. */
function render(html: string, siteUrl: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/, "") // comentario de documentación
    .replace(
      /\{\{ if \.Data\.(\w+) \}\}([\s\S]*?)(?:\{\{ else \}\}([\s\S]*?))?\{\{ end \}\}/g,
      (_, k, yes, no) => (DATA[k] ? yes : (no ?? "")),
    )
    .replace(/\{\{ \.Data\.(\w+) \}\}/g, (_, k) => DATA[k] ?? "")
    .replace(/\{\{ \.SiteURL \}\}/g, siteUrl)
    .replace(/\{\{ \.Email \}\}/g, "fermin@iphonecenter.com.ar")
    .replace(/\{\{ \.TokenHash \}\}/g, "abc123tokenhash");
}

/** Solo dev: `/qa/mails` muestra los templates de `supabase/email-templates/`
 * tal como los vería el usuario (datos de ejemplo). Editás el .html y
 * recargás. */
export default async function QaMailsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const h = headers();
  const siteUrl = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const mails = await Promise.all(
    TEMPLATES.map(async (t) => ({
      ...t,
      html: render(
        await readFile(path.join(process.cwd(), "supabase/email-templates", t.file), "utf8"),
        siteUrl,
      ),
    })),
  );

  return (
    <main className="mx-auto max-w-[2100px] space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Mails de Auth</h1>
      <p className="text-sm text-neutral-500">
        Fuente: <code>supabase/email-templates/*.html</code> · datos de ejemplo: {DATA.nombre} / {DATA.organizacion} / fermin@iphonecenter.com.ar
      </p>
      <MailsVista mails={mails} />
    </main>
  );
}
