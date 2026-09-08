"use client";

import { useState } from "react";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Field, Input } from "@/components/ui/field";
import { toneClass, type Tone } from "@/lib/status";
import { usuarios, negocio, plantillasWhatsApp } from "@/lib/mock-data";
import type { Role } from "@/lib/types";

const rolTone: Record<Role, Tone> = {
  admin: "violet",
  vendedor: "blue",
  tecnico: "green",
};
const rolLabel: Record<Role, string> = {
  admin: "Admin / Dueño",
  vendedor: "Vendedor",
  tecnico: "Técnico",
};

type Tab = "usuarios" | "plantillas" | "negocio";

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>("usuarios");

  return (
    <Section title="Configuración">
      <div className="space-y-5">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "usuarios", label: "Usuarios y roles" },
            { value: "plantillas", label: "Plantillas WhatsApp" },
            { value: "negocio", label: "Datos del negocio" },
          ]}
        />

        {tab === "usuarios" && (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Rol</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-neutral-100 first:border-t-0"
                  >
                    <td className="px-5 py-3 font-medium">{u.nombre}</td>
                    <td className="px-5 py-3 text-neutral-500">{u.email}</td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset " +
                          toneClass[rolTone[u.rol]]
                        }
                      >
                        {rolLabel[u.rol]}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={u.activo ? "green" : "gray"}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {tab === "plantillas" && (
          <div className="grid gap-4 lg:grid-cols-2">
            {plantillasWhatsApp.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{p.nombre}</p>
                  <button className="text-xs font-medium text-accent hover:underline">
                    Editar
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-[13px] text-neutral-600">
                  {p.texto}
                </p>
              </Card>
            ))}
          </div>
        )}

        {tab === "negocio" && (
          <Card className="max-w-lg p-5">
            <div className="space-y-3">
              <Field label="Nombre">
                <Input defaultValue={negocio.nombre} />
              </Field>
              <Field label="Dirección">
                <Input defaultValue={negocio.direccion} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Teléfono">
                  <Input defaultValue={negocio.telefono} />
                </Field>
                <Field label="CUIT">
                  <Input defaultValue={negocio.cuit} />
                </Field>
              </div>
              <Field label="Horario de atención">
                <Input defaultValue={negocio.horario} />
              </Field>
              <Button size="sm">Guardar cambios</Button>
            </div>
          </Card>
        )}
      </div>
    </Section>
  );
}
