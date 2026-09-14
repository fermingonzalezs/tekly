import { Smartphone } from "lucide-react";

/** Header/card del mismo estilo que `Dialog` con `accent` (header índigo,
 * título en mayúscula, línea + descripción) -- para las pantallas de auth,
 * que no son un diálogo disparado por el usuario sino la página entera. */
export function AuthModal({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-accent bg-white shadow-2xl">
      <div className="border-b border-[#352f86] bg-[#352f86] px-5 py-4 text-white">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15">
            <Smartphone className="h-4 w-4" />
          </div>
          <h1 className="text-base font-semibold uppercase tracking-wide">{title}</h1>
        </div>
        {description && (
          <>
            <div className="mb-1.5 mt-2 h-px w-full bg-white/20" />
            <p className="text-sm text-white/70">{description}</p>
          </>
        )}
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}
