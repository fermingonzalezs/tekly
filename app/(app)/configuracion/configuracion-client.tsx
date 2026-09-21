"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { dotClass, rolLabel, rolTone, medioPago as medioPagoCfg, MEDIOS_VENTA } from "@/lib/status";
import { thDivider } from "@/lib/ui-styles";
import { cn } from "@/lib/utils";
import { updateOwnProfileAction } from "@/app/(app)/actions";
import { inviteMemberAction, setMemberRoleAction, updateNegocioAction } from "./actions";
import { ImportarDatos } from "./importar-datos";
import {
  ReciboShell,
  ReciboGarantiaItems,
  ReciboNota,
  ReciboNotaLista,
  ReciboSello,
} from "@/components/recibos/recibo";
import type { SessionUser, Rol } from "@/lib/auth/types";
import type { Miembro, Negocio } from "@/lib/db/configuracion";

type Tab = "usuarios" | "negocio" | "recibos" | "importar" | "cuenta";

const ROLES: Rol[] = ["admin", "vendedor", "tecnico"];

export function ConfiguracionClient({
  user,
  miembros,
  negocio,
}: {
  user: SessionUser;
  miembros: Miembro[];
  negocio: Negocio | null;
}) {
  const esAdmin = user.rol === "admin";
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(
    esAdmin && tabParam ? tabParam : esAdmin ? "usuarios" : "cuenta",
  );

  const [invitando, setInvitando] = useState(false);
  const [cambiandoRolDe, setCambiandoRolDe] = useState<Miembro | null>(null);

  if (!esAdmin) {
    return (
      <Section title="Mi cuenta">
        <MiCuenta user={user} />
      </Section>
    );
  }

  return (
    <Section title="Configuración">
      <div className="space-y-5">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "usuarios", label: "Usuarios y roles" },
            { value: "negocio", label: "Datos del negocio" },
            { value: "recibos", label: "Recibos" },
            { value: "importar", label: "Importar datos" },
            { value: "cuenta", label: "Mi cuenta" },
          ]}
        />

        {tab === "usuarios" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => setInvitando(true)}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
              >
                <Plus className="h-4 w-4" />
                Invitar usuario
              </button>
            </div>
            <div className="space-y-2 md:hidden">
              {miembros.map((u) => (
                <Card key={u.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">{u.nombre}</p>
                      <p className="truncate text-xs text-neutral-500">{u.email}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          u.activo ? dotClass.green : dotClass.gray,
                        )}
                      />
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <div className="mt-2.5 border-t border-neutral-100 pt-2.5">
                    <button
                      onClick={() => setCambiandoRolDe(u)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                    >
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", dotClass[rolTone[u.rol]])}
                      />
                      {rolLabel[u.rol]}
                    </button>
                  </div>
                </Card>
              ))}
              {miembros.length === 0 && (
                <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
                  Sin usuarios todavía.
                </p>
              )}
            </div>

            <Card className="hidden overflow-hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                    <th className={cn("px-5 py-3 text-center", thDivider)}>Nombre</th>
                    <th className={cn("px-5 py-3 text-center", thDivider)}>Email</th>
                    <th className={cn("px-5 py-3 text-center", thDivider)}>Rol</th>
                    <th className="px-5 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {miembros.map((u) => (
                    <tr
                      key={u.id}
                      className="border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
                    >
                      <td className="px-5 py-2 text-center font-medium">{u.nombre}</td>
                      <td className="px-5 py-2 text-center text-neutral-500">{u.email}</td>
                      <td className="px-5 py-2 text-center">
                        <button
                          onClick={() => setCambiandoRolDe(u)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                        >
                          <span
                            className={cn("h-1.5 w-1.5 rounded-full", dotClass[rolTone[u.rol]])}
                          />
                          {rolLabel[u.rol]}
                        </button>
                      </td>
                      <td className="px-5 py-2 text-center">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              u.activo ? dotClass.green : dotClass.gray,
                            )}
                          />
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {miembros.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-sm text-neutral-400">
                        Sin usuarios todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab === "negocio" && negocio && <NegocioForm negocio={negocio} />}

        {tab === "recibos" && negocio && <RecibosForm negocio={negocio} />}

        {tab === "importar" && <ImportarDatos />}

        {tab === "cuenta" && <MiCuenta user={user} />}
      </div>

      <InvitarUsuarioDialog open={invitando} onClose={() => setInvitando(false)} />
      <CambiarRolDialog
        key={`rol-${cambiandoRolDe?.id ?? "cerrado"}`}
        miembro={cambiandoRolDe}
        onClose={() => setCambiandoRolDe(null)}
      />
    </Section>
  );
}

function InvitarUsuarioDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<Rol>("vendedor");
  const [error, setError] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);
  const [pending, startTransition] = useTransition();

  function cerrar() {
    setEnviada(false);
    onClose();
  }

  function enviar() {
    setError(null);
    startTransition(async () => {
      const result = await inviteMemberAction(email.trim(), nombre.trim(), rol);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEmail("");
      setNombre("");
      setRol("vendedor");
      setEnviada(true);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={cerrar}
      accent
      title="Invitar usuario"
      footer={
        <>
          <button
            onClick={cerrar}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto"
          >
            {enviada ? "Cerrar" : "Cancelar"}
          </button>
          <button
            onClick={enviar}
            disabled={pending || !email.trim() || !nombre.trim()}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
          >
            {pending ? "Invitando…" : "Invitar"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nombre">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Rol">
          <Select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {rolLabel[r]}
              </option>
            ))}
          </Select>
        </Field>
        {enviada && <p className="text-xs text-emerald-600">Invitación enviada.</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}

function CambiarRolDialog({
  miembro,
  onClose,
}: {
  miembro: Miembro | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [rol, setRol] = useState<Rol>(miembro?.rol ?? "vendedor");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function guardar() {
    if (!miembro) return;
    setError(null);
    startTransition(async () => {
      const result = await setMemberRoleAction(miembro.id, rol);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog
      open={!!miembro}
      onClose={onClose}
      accent
      title={miembro ? `Cambiar rol · ${miembro.nombre}` : ""}
      footer={
        <>
          <button
            onClick={onClose}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={pending}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <Field label="Rol">
        <Select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {rolLabel[r]}
            </option>
          ))}
        </Select>
      </Field>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </Dialog>
  );
}

function NegocioForm({ negocio }: { negocio: Negocio }) {
  const router = useRouter();
  const [form, setForm] = useState(negocio);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function guardar() {
    setSaved(false);
    startTransition(async () => {
      await updateNegocioAction(form);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="space-y-3">
            <Field label="Nombre">
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </Field>
            <Field label="Dirección">
              <Input
                value={form.direccion}
                onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Teléfono">
                <Input
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                />
              </Field>
              <Field label="CUIT">
                <Input
                  value={form.cuit}
                  onChange={(e) => setForm((f) => ({ ...f, cuit: e.target.value }))}
                />
              </Field>
            </div>
            <Field label="Horario de atención">
              <Input
                value={form.horario}
                onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value }))}
              />
            </Field>
            <Field label="Objetivo del mes (USD)">
              <Input
                type="number"
                min={0}
                value={form.objetivoMesUsd}
                onChange={(e) =>
                  setForm((f) => ({ ...f, objetivoMesUsd: Number(e.target.value) }))
                }
              />
            </Field>
          </div>
        </Card>
        <Card className="p-5">
          <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Recargo por medio de pago
          </p>
          <div className="space-y-2">
            {MEDIOS_VENTA.map((m) => (
              <div key={m} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-neutral-600">
                  {medioPagoCfg[m].emoji} {medioPagoCfg[m].label}
                </span>
                <Input
                  className="w-24 text-center"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.recargosMediosPago[m] ?? ""}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    setForm((f) => ({
                      ...f,
                      recargosMediosPago: { ...f.recargosMediosPago, [m]: v || undefined },
                    }));
                  }}
                />
                <span className="text-sm text-neutral-400">%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={guardar}
          disabled={pending}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        {saved && <p className="text-xs text-emerald-600">Cambios guardados.</p>}
      </div>
    </div>
  );
}

/** Textos del recibo de garantía (Ítem "Garantía" en Ventas) -- el resto de
 * los recibos (comprobante de venta, canje, mercadería/presupuesto/entrega
 * de Reparaciones) tienen su nota legal fija en el código, ya afinada por
 * tipo; acá solo se edita lo que sí varía por negocio: cuánto dura la
 * garantía y las condiciones/causales propias de cada empresa. */
function RecibosForm({ negocio }: { negocio: Negocio }) {
  const router = useRouter();
  const [form, setForm] = useState(negocio);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function guardar() {
    setSaved(false);
    startTransition(async () => {
      await updateNegocioAction(form);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,22rem)_1fr]">
      <Card className="h-fit p-5">
        <div className="space-y-3">
          <Field label="Texto de garantía por ítem">
            <Input
              value={form.garantiaTexto}
              onChange={(e) =>
                setForm((f) => ({ ...f, garantiaTexto: e.target.value }))
              }
              placeholder="Ej: Garantía oficial Apple (12 meses)"
            />
          </Field>
          <Field label="Condiciones de garantía">
            <Textarea
              rows={5}
              value={form.garantiaCondiciones}
              onChange={(e) =>
                setForm((f) => ({ ...f, garantiaCondiciones: e.target.value }))
              }
              placeholder="Párrafos separados por una línea en blanco."
            />
          </Field>
          <Field label="Importante">
            <Textarea
              rows={4}
              value={form.garantiaImportante}
              onChange={(e) =>
                setForm((f) => ({ ...f, garantiaImportante: e.target.value }))
              }
              placeholder="Párrafos separados por una línea en blanco."
            />
          </Field>
          <Field label="Causales de anulación">
            <Textarea
              rows={4}
              value={form.garantiaCausales}
              onChange={(e) =>
                setForm((f) => ({ ...f, garantiaCausales: e.target.value }))
              }
              placeholder="Una causal por línea."
            />
          </Field>
          {saved && <p className="text-xs text-emerald-600">Cambios guardados.</p>}
          <button
            onClick={guardar}
            disabled={pending}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </Card>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Preview
        </p>
        <ReciboShell
          titulo="Garantía"
          nro="V-123"
          fecha="15/09/2026"
          cliente="Cliente de ejemplo"
          negocio={negocio}
        >
          <ReciboGarantiaItems
            items={[
              {
                detalle: "iPhone 13 128GB Azul",
                serial: "358240051111110",
                garantia: form.garantiaTexto || "—",
                precioUsd: 450,
              },
            ]}
          />
          <ReciboSello />
          <ReciboNota titulo="Condiciones de garantía" texto={form.garantiaCondiciones} />
          <ReciboNota titulo="Importante" texto={form.garantiaImportante} tono="warning" />
          <ReciboNotaLista
            titulo="Causales de anulación de la garantía"
            texto={form.garantiaCausales}
          />
        </ReciboShell>
      </div>
    </div>
  );
}

function MiCuenta({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(user.nombre);
  const [alias, setAlias] = useState(user.alias ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function guardar() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateOwnProfileAction(nombre.trim(), alias.trim());
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <Card className="max-w-lg p-5">
      <div className="space-y-3">
        <Field label="Nombre">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Field>
        <Field label="Alias">
          <Input value={alias} onChange={(e) => setAlias(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input value={user.email} disabled />
        </Field>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {saved && !error && (
          <p className="text-xs text-emerald-600">Cambios guardados.</p>
        )}
        <button
          onClick={guardar}
          disabled={pending || !nombre.trim()}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50"
        >
          Guardar cambios
        </button>
      </div>
    </Card>
  );
}
