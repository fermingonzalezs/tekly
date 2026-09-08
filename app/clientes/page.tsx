"use client";

import { useMemo, useState } from "react";
import { Phone, Mail, Plus } from "lucide-react";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { DemografiaClientes } from "@/components/clientes/demografia";
import { ticketStatus, medioPago } from "@/lib/status";
import { clientes as seed, ventas, tickets } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";
import type { Cliente } from "@/lib/types";

const rid = () => Math.random().toString(36).slice(2);

export default function ClientesPage() {
  const [list, setList] = useState<Cliente[]>(seed);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Cliente | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(
    () =>
      list.filter((c) => c.nombre.toLowerCase().includes(q.toLowerCase())),
    [list, q],
  );

  return (
    <Section title="Clientes">
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-72"
          />
          <span className="ml-auto text-sm text-neutral-400">
            {filtered.length} cliente{filtered.length === 1 ? "" : "s"}
          </span>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nuevo cliente
          </Button>
        </div>

        <DemografiaClientes />

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Teléfono</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Desde</th>
                <th className="px-5 py-3">Compras</th>
                <th className="px-5 py-3">Reparaciones</th>
                <th className="px-5 py-3">Gastado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setOpen(c)}
                  className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
                >
                  <td className="px-5 py-3 text-start font-medium">{c.nombre}</td>
                  <td className="px-5 py-3 text-neutral-500">{c.telefono}</td>
                  <td className="px-5 py-3 text-neutral-500">{c.email}</td>
                  <td className="px-5 py-3 text-neutral-500">{c.desde}</td>
                  <td className="px-5 py-3 tabular-nums">{c.compras}</td>
                  <td className="px-5 py-3 tabular-nums">{c.reparaciones}</td>
                  <td className="px-5 py-3 font-semibold">
                    {fmtUsd(c.gastadoUsd)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-sm text-neutral-400"
                  >
                    Sin clientes para esta búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <Dialog
        open={!!open}
        onClose={() => setOpen(null)}
        size="lg"
        title={open?.nombre ?? ""}
        description={open ? `Cliente desde ${open.desde}` : ""}
      >
        {open && <Ficha cliente={open} />}
      </Dialog>

      <NuevoClienteDialog
        key={creating ? "n" : "n0"}
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(c) => {
          setList((p) => [c, ...p]);
          setCreating(false);
        }}
      />
    </Section>
  );
}

function Ficha({ cliente }: { cliente: Cliente }) {
  const compras = ventas.filter((v) => v.clienteId === cliente.id);
  const reparaciones = tickets.filter((t) => t.clienteId === cliente.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5 text-neutral-600">
          <Phone className="h-4 w-4 text-neutral-400" /> {cliente.telefono}
        </span>
        <span className="inline-flex items-center gap-1.5 text-neutral-600">
          <Mail className="h-4 w-4 text-neutral-400" /> {cliente.email}
        </span>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Historial de compras
        </p>
        <div className="rounded-xl border border-neutral-200">
          {compras.length === 0 && (
            <p className="px-4 py-3 text-sm text-neutral-400">Sin compras.</p>
          )}
          {compras.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 text-sm last:border-b-0"
            >
              <div>
                <span className="font-medium text-neutral-500">{v.id}</span>{" "}
                <span className="text-neutral-400">· {v.fecha}</span>
                <span className="block text-xs text-neutral-400">
                  {v.items.map((i) => i.detalle).join(" · ")}
                </span>
              </div>
              <div className="text-right">
                <span className="font-semibold">{fmtUsd(v.totalUsd)}</span>
                {v.pagos.map((p, i) => (
                  <Badge
                    key={i}
                    tone={medioPago[p.medio].tone}
                    className="ml-1 align-middle"
                  >
                    {medioPago[p.medio].label}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Historial de reparaciones
        </p>
        <div className="rounded-xl border border-neutral-200">
          {reparaciones.length === 0 && (
            <p className="px-4 py-3 text-sm text-neutral-400">Sin reparaciones.</p>
          )}
          {reparaciones.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 text-sm last:border-b-0"
            >
              <div>
                <span className="font-medium text-neutral-500">#{t.id}</span>{" "}
                <span className="text-neutral-400">· {t.equipo}</span>
                <span className="block text-xs text-neutral-400">{t.falla}</span>
              </div>
              <Badge tone={ticketStatus[t.estado].tone}>
                {ticketStatus[t.estado].label}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NuevoClienteDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (c: Cliente) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");

  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const hoy = new Date();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nuevo cliente"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!nombre.trim()}
            onClick={() =>
              onCreate({
                id: `c-${rid()}`,
                nombre: nombre.trim(),
                telefono: telefono.trim() || "—",
                email: email.trim() || "—",
                desde: `${meses[hoy.getMonth()]} ${hoy.getFullYear()}`,
                compras: 0,
                reparaciones: 0,
                gastadoUsd: 0,
              })
            }
          >
            Crear cliente
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nombre y apellido">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Juan Pérez"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Teléfono">
            <Input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+54 9 11 …"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@mail.com"
            />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
