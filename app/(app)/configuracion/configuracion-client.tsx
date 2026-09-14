"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { dotClass, rolLabel, rolTone } from "@/lib/status";
import { thDivider } from "@/lib/ui-styles";
import { cn } from "@/lib/utils";
import { updateOwnProfileAction } from "@/app/(app)/actions";
import {
  inviteMemberAction,
  setMemberRoleAction,
  saveWhatsappTemplateAction,
  updateNegocioAction,
} from "./actions";
import type { SessionUser, Rol } from "@/lib/auth/types";
import type { Miembro, WhatsappTemplate, Negocio } from "@/lib/db/configuracion";

type Tab = "usuarios" | "plantillas" | "negocio" | "cuenta";

const ROLES: Rol[] = ["admin", "vendedor", "tecnico"];

export function ConfiguracionClient({
  user,
  miembros,
  templates,
  negocio,
}: {
  user: SessionUser;
  miembros: Miembro[];
  templates: WhatsappTemplate[];
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
  const [editandoTemplate, setEditandoTemplate] = useState<WhatsappTemplate | "nueva" | null>(
    null,
  );

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
            { value: "plantillas", label: "Plantillas WhatsApp" },
            { value: "negocio", label: "Datos del negocio" },
            { value: "cuenta", label: "Mi cuenta" },
          ]}
        />

        {tab === "usuarios" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setInvitando(true)}>
                Invitar usuario
              </Button>
            </div>
            <Card className="overflow-hidden">
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

        {tab === "plantillas" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setEditandoTemplate("nueva")}>
                Nueva plantilla
              </Button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {templates.map((p) => (
                <Card key={p.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{p.nombre}</p>
                    <button
                      onClick={() => setEditandoTemplate(p)}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Editar
                    </button>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-[13px] text-neutral-600">
                    {p.texto}
                  </p>
                </Card>
              ))}
              {templates.length === 0 && (
                <p className="text-sm text-neutral-400">Sin plantillas todavía.</p>
              )}
            </div>
          </div>
        )}

        {tab === "negocio" && negocio && <NegocioForm negocio={negocio} />}

        {tab === "cuenta" && <MiCuenta user={user} />}
      </div>

      <InvitarUsuarioDialog open={invitando} onClose={() => setInvitando(false)} />
      <CambiarRolDialog
        key={cambiandoRolDe?.id ?? "cerrado"}
        miembro={cambiandoRolDe}
        onClose={() => setCambiandoRolDe(null)}
      />
      <TemplateDialog
        key={editandoTemplate === "nueva" ? "nueva" : (editandoTemplate?.id ?? "cerrado")}
        template={editandoTemplate === "nueva" ? null : editandoTemplate}
        open={editandoTemplate !== null}
        onClose={() => setEditandoTemplate(null)}
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
  const [pending, startTransition] = useTransition();

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
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invitar usuario"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" disabled={pending || !email.trim() || !nombre.trim()} onClick={enviar}>
            {pending ? "Invitando…" : "Invitar"}
          </Button>
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
      title={miembro ? `Cambiar rol · ${miembro.nombre}` : ""}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" disabled={pending} onClick={guardar}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
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

function TemplateDialog({
  template,
  open,
  onClose,
}: {
  template: WhatsappTemplate | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(template?.nombre ?? "");
  const [texto, setTexto] = useState(template?.texto ?? "");
  const [pending, startTransition] = useTransition();

  function guardar() {
    startTransition(async () => {
      await saveWhatsappTemplateAction(template?.id ?? null, {
        nombre: nombre.trim(),
        texto: texto.trim(),
      });
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={template ? "Editar plantilla" : "Nueva plantilla"}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" disabled={pending || !nombre.trim() || !texto.trim()} onClick={guardar}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nombre">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Field>
        <Field label="Texto">
          <Textarea rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </Field>
      </div>
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
    <Card className="max-w-lg p-5">
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
        <div className="grid grid-cols-2 gap-3">
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
        {saved && <p className="text-xs text-emerald-600">Cambios guardados.</p>}
        <Button size="sm" disabled={pending} onClick={guardar}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </Card>
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
        <Button size="sm" disabled={pending || !nombre.trim()} onClick={guardar}>
          Guardar cambios
        </Button>
      </div>
    </Card>
  );
}
