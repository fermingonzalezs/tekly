import { notFound } from "next/navigation";
import { Button, IconButton } from "@/components/ui/button";
import { Plus, Trash2, Pencil, X, Search } from "lucide-react";

export const metadata = { title: "QA · Botones" };

// `use client` no hace falta: Button/IconButton soportan onClick opcional y
// acá no se interactúa; igual son server-safe (IconButton fuerza type=button).
export default function QaPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const variantes = [
    "primary",
    "outline",
    "tonal",
    "ghost",
    "danger",
    "danger-outline",
    "link",
    "inverse",
  ] as const;
  const sizes = ["sm", "md", "lg", "xl"] as const;

  return (
    <main className="mx-auto max-w-5xl space-y-10 p-8">
      <h1 className="text-2xl font-semibold">Galería de botones (plan 010)</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Variantes × md</h2>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4">
          {variantes.map((v) => (
            <Button key={v} variant={v}>
              {v}
            </Button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tamaños (primary)</h2>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4">
          {sizes.map((s) => (
            <Button key={s} size={s}>
              size {s}
            </Button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Con chip, ícono, loading, disabled</h2>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4">
          <Button chip>Con chip (solo landing)</Button>
          <Button icon={Plus}>Primary + ícono</Button>
          <Button icon={Plus} variant="outline">Outline + ícono</Button>
          <Button icon={Plus} variant="tonal">Tonal + ícono</Button>
          <Button icon={Trash2} variant="danger-outline">Eliminar</Button>
          <Button icon={Plus} variant="ghost">Ghost + ícono</Button>
          <Button icon={Plus} size="sm" variant="tonal">Sm + ícono</Button>
          <Button icon={Plus} loading variant="tonal">Cargando</Button>
          <Button loading>Cargando</Button>
          <Button disabled>Deshabilitado</Button>
          <Button variant="tonal" fullOnMobile>
            fullOnMobile
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">IconButton</h2>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4">
          <IconButton aria-label="Nuevo" icon={Plus} />
          <IconButton aria-label="Editar" icon={Pencil} variant="outline" />
          <IconButton aria-label="Borrar" icon={Trash2} variant="danger-ghost" />
          <IconButton aria-label="Cerrar" icon={X} size="lg" />
          <IconButton aria-label="Nuevo" icon={Plus} shape="square" />
          <IconButton aria-label="Buscar o crear" icon={Search} variant="primary" size="xl" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sobre fondo accent (inverse)</h2>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-accent p-4">
          <Button variant="inverse" chip>
            Empezar gratis
          </Button>
          <Button variant="outline">Ingresar</Button>
        </div>
      </section>
    </main>
  );
}
