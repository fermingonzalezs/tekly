import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { MailsVista } from "./mails-vista";

export const metadata = { title: "QA · Mails de Auth" };
export const dynamic = "force-dynamic";

const TEMPLATES = [
  { file: "confirm-signup.html", label: "Confirm signup", subject: "Confirmá tu cuenta en Tekly" },
  { file: "invite.html", label: "Invite user", subject: "Te invitaron a sumarte a tu equipo en Tekly" },
  { file: "recovery.html", label: "Reset Password", subject: "Restablecé tu contraseña de Tekly" },
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
  const h = await headers();
  const siteUrl = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const mails = await Promise.all(
    TEMPLATES.map(async (t) => {
      const source = await readFile(
        path.join(process.cwd(), "supabase/email-templates", t.file),
        "utf8",
      );
      return { ...t, source, html: render(source, siteUrl) };
    }),
  );

  return (
    <main className="mx-auto max-w-[2100px] space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Mails de Auth</h1>
      <p className="text-sm text-neutral-500">
        Fuente: <code>supabase/email-templates/*.html</code> · datos de ejemplo: {DATA.nombre} / {DATA.organizacion} / fermin@iphonecenter.com.ar
      </p>
      <ol className="max-w-3xl list-decimal space-y-1 pl-5 text-sm text-neutral-600">
        <li>
          Supabase Dashboard → proyecto <code>tekly</code> → <strong>Authentication</strong> →{" "}
          <strong>Emails</strong> → <strong>Templates</strong>.
        </li>
        <li>
          Elegí el template con el mismo nombre que cada columna de abajo (Confirm signup, Invite
          user, Reset Password).
        </li>
        <li>
          <strong>Copiar HTML</strong> y pegarlo en <em>Message body</em> (modo código/source),
          reemplazando lo que haya. <strong>Copiar asunto</strong> y pegarlo en <em>Subject</em>.
        </li>
        <li>Guardar. Las variables <code>{"{{ .SiteURL }}"}</code> etc. las completa Supabase al enviar.</li>
      </ol>
      <MailsVista mails={mails} />
    </main>
  );
}
