"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Store, Trash2 } from "lucide-react";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { dotClass, rolLabel, rolTone, medioPago as medioPagoCfg, MEDIOS_VENTA } from "@/lib/status";
import { thDivider } from "@/lib/ui-styles";
import { cn } from "@/lib/utils";
import { updateOwnProfileAction } from "@/app/(app)/actions";
import {
  inviteMemberAction,
  setMemberRoleAction,
  setMemberEmailAction,
  deactivateMemberAction,
  updateNegocioAction,
  uploadLogoAction,
  removeLogoAction,
} from "./actions";
import { ImportarDatos } from "./importar-datos";
import { PALETAS } from "@/lib/theme-presets";
import type { SessionUser, Rol } from "@/lib/auth/types";
import type { Miembro, Negocio } from "@/lib/db/configuracion";

type Tab = "usuarios" | "negocio" | "preferencias" | "recibos" | "importar" | "cuenta";

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
  const [editandoMiembro, setEditandoMiembro] = useState<Miembro | null>(null);

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
            { value: "preferencias", label: "Preferencias" },
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
                <Card
                  key={u.id}
                  onClick={() => setEditandoMiembro(u)}
                  className="cursor-pointer p-3"
                >
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
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", dotClass[rolTone[u.rol]])}
                      />
                      {rolLabel[u.rol]}
                    </span>
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
                      onClick={() => setEditandoMiembro(u)}
                      className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
                    >
                      <td className="px-5 py-2 text-center font-medium">{u.nombre}</td>
                      <td className="px-5 py-2 text-center text-neutral-500">{u.email}</td>
                      <td className="px-5 py-2 text-center">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                          <span
                            className={cn("h-1.5 w-1.5 rounded-full", dotClass[rolTone[u.rol]])}
                          />
                          {rolLabel[u.rol]}
                        </span>
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
        {tab === "preferencias" && negocio && <PreferenciasForm negocio={negocio} />}

        {tab === "recibos" && negocio && <RecibosForm negocio={negocio} />}

        {tab === "importar" && <ImportarDatos />}

        {tab === "cuenta" && <MiCuenta user={user} />}
      </div>

      <InvitarUsuarioDialog open={invitando} onClose={() => setInvitando(false)} />
      <EditarMiembroDialog
        key={`miembro-${editandoMiembro?.id ?? "cerrado"}`}
        miembro={editandoMiembro}
        esUnoMismo={editandoMiembro?.id === user.id}
        onClose={() => setEditandoMiembro(null)}
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

function EditarMiembroDialog({
  miembro,
  esUnoMismo,
  onClose,
}: {
  miembro: Miembro | null;
  /** El admin abrió su propia fila -- acá no se edita rol/email ni se
   * elimina (mismo bloqueo que valida `deactivateMember` server-side): el
   * autoservicio de nombre/alias vive en la pestaña "Mi cuenta". */
  esUnoMismo: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [rol, setRol] = useState<Rol>(miembro?.rol ?? "vendedor");
  const [email, setEmail] = useState(miembro?.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pendingEliminar, startEliminarTransition] = useTransition();

  function guardar() {
    if (!miembro) return;
    setError(null);
    startTransition(async () => {
      if (rol !== miembro.rol) {
        const result = await setMemberRoleAction(miembro.id, rol);
        if (result.error) {
          setError(result.error);
          return;
        }
      }
      const emailLimpio = email.trim();
      if (emailLimpio && emailLimpio !== miembro.email) {
        const result = await setMemberEmailAction(miembro.id, emailLimpio);
        if (result.error) {
          setError(result.error);
          return;
        }
      }
      router.refresh();
      onClose();
    });
  }

  function eliminar() {
    if (!miembro) return;
    startEliminarTransition(async () => {
      const result = await deactivateMemberAction(miembro.id);
      if (result.error) {
        setError(result.error);
        setConfirmEliminar(false);
        return;
      }
      setConfirmEliminar(false);
      router.refresh();
      onClose();
    });
  }

  return (
    <Fragment>
      <Dialog
        open={!!miembro}
        onClose={onClose}
        accent
        title={miembro ? `Editar usuario · ${miembro.nombre}` : ""}
        footer={
          esUnoMismo ? (
            <button
              onClick={onClose}
              className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:ml-auto sm:w-auto"
            >
              Cerrar
            </button>
          ) : (
            <>
              <button
                onClick={() => setConfirmEliminar(true)}
                className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-red-200 px-4 text-sm font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 sm:mr-auto sm:w-auto"
              >
                <Trash2 className="h-4 w-4" /> Eliminar usuario
              </button>
              <button
                onClick={onClose}
                className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={pending || !email.trim()}
                className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
              >
                {pending ? "Guardando…" : "Guardar"}
              </button>
            </>
          )
        }
      >
        {esUnoMismo ? (
          <p className="text-sm text-neutral-500">
            No podés cambiar tu propio rol ni email, ni eliminar tu cuenta,
            desde acá. Para cambiar tu nombre o alias, andá a la pestaña «Mi
            cuenta».
          </p>
        ) : (
          <div className="space-y-3">
            <Field label="Rol">
              <Select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {rolLabel[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
        )}
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      </Dialog>

      {miembro && !esUnoMismo && (
        <ConfirmDialog
          open={confirmEliminar}
          onClose={() => setConfirmEliminar(false)}
          onConfirm={eliminar}
          pending={pendingEliminar}
          title="¿Eliminar usuario?"
          confirmLabel="Eliminar usuario"
        >
          Se eliminará a «{miembro.nombre}» -- pierde acceso a Tekly de
          inmediato. Su historial (ventas, tickets, movimientos) se conserva.
        </ConfirmDialog>
      )}
    </Fragment>
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
    <div className="max-w-lg space-y-5">
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
        </div>
      </Card>
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

/** Apariencia (color + logo) y comercial (objetivo del mes + recargos por
 * medio de pago) -- separado de "Datos del negocio" a pedido, no es
 * información de facturación/contacto. Mismo `updateNegocioAction` de
 * siempre: el form arranca del `negocio` completo y solo expone estos
 * campos, así que guardar no pisa nombre/dirección/etc. */
function PreferenciasForm({ negocio }: { negocio: Negocio }) {
  const router = useRouter();
  const [form, setForm] = useState(negocio);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  // Logo: flujo propio (upload/remove), no se guarda con el form -- sube
  // apenas se elige el archivo (no hay botón "Subir" aparte: con dos
  // acciones de guardado en la misma pestaña, era fácil elegir el archivo y
  // tocar el "Guardar cambios" general, que no toca el logo). El preview
  // sale del prop `negocio.logoUrl` -- el useState de arriba no se
  // re-sincroniza con props nuevas tras el refresh.
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoPending, startLogoTransition] = useTransition();
  const [logoError, setLogoError] = useState<string | null>(null);

  function guardar() {
    setSaved(false);
    startTransition(async () => {
      await updateNegocioAction(form);
      setSaved(true);
      router.refresh();
    });
  }

  function subirLogo(file: File) {
    setLogoError(null);
    startLogoTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("file", file);
        await uploadLogoAction(fd);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } catch {
        setLogoError("No se pudo subir el logo. Probá de nuevo en un rato.");
      }
    });
  }

  function quitarLogo() {
    setLogoError(null);
    startLogoTransition(async () => {
      try {
        await removeLogoAction();
        router.refresh();
      } catch {
        setLogoError("No se pudo quitar el logo.");
      }
    });
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-3 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Apariencia
          </p>
          <div className="space-y-3">
            <Field label="Color del tema">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {PALETAS.map((p) => {
                  const elegida = form.colorTema === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, colorTema: p.id }))}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors",
                        elegida
                          ? "border-accent bg-accent-soft"
                          : "border-neutral-200 hover:border-neutral-300",
                      )}
                    >
                      <span
                        className={cn(
                          "h-6 w-6 rounded-full",
                          elegida && "ring-2 ring-accent ring-offset-2",
                        )}
                        style={{ backgroundColor: p.chart[2] }}
                      />
                      <span className="text-[11px] font-medium text-neutral-600">
                        {p.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Logo">
              <div className="flex flex-wrap items-center gap-3">
                {negocio.logoUrl ? (
                  <img
                    src={negocio.logoUrl}
                    alt="Logo actual"
                    className="h-12 w-12 rounded-xl border border-neutral-200 bg-white object-contain p-1"
                  />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-400">
                    <Store className="h-5 w-5" />
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  disabled={logoPending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) subirLogo(file);
                  }}
                  className="block w-full max-w-xs text-sm text-neutral-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-neutral-600 hover:file:bg-neutral-200 disabled:opacity-50"
                />
                {logoPending && (
                  <span className="text-xs text-neutral-400">Subiendo…</span>
                )}
                {negocio.logoUrl && !logoPending && (
                  <button
                    onClick={quitarLogo}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
                  >
                    Quitar logo
                  </button>
                )}
              </div>
              {logoError && <p className="mt-2 text-xs text-red-600">{logoError}</p>}
            </Field>
          </div>
        </Card>
        <Card className="p-5">
          <div className="space-y-4">
            <div>
              <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Objetivo del mes
              </p>
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
            <div>
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
            </div>
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

type DocTab = "garantia" | "ingreso" | "presupuesto" | "egreso";

const DOC_TABS: { value: DocTab; label: string }[] = [
  { value: "garantia", label: "Garantía" },
  { value: "ingreso", label: "Ticket de ingreso" },
  { value: "presupuesto", label: "Presupuesto" },
  { value: "egreso", label: "Ticket de egreso" },
];

/** Textos editables de los 4 documentos con recibo (Garantía de Ventas +
 * los 3 de Reparaciones) -- separados por tab (`DOC_TABS`) para que cada
 * uno edite solo el suyo, en vez de un formulario largo único. */
function RecibosForm({ negocio }: { negocio: Negocio }) {
  const router = useRouter();
  const [form, setForm] = useState(negocio);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [docTab, setDocTab] = useState<DocTab>("garantia");

  function guardar() {
    setSaved(false);
    startTransition(async () => {
      await updateNegocioAction(form);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Tabs value={docTab} onChange={setDocTab} options={DOC_TABS} />
      <Card className="h-fit max-w-2xl p-5">
        <div className="space-y-3">
          {docTab === "garantia" && (
            <>
              <Field label="Texto de garantía por ítem">
                <Input
                  value={form.garantiaTexto}
                  onChange={(e) => setForm((f) => ({ ...f, garantiaTexto: e.target.value }))}
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
                  onChange={(e) => setForm((f) => ({ ...f, garantiaCausales: e.target.value }))}
                  placeholder="Una causal por línea."
                />
              </Field>
            </>
          )}
          {docTab === "ingreso" && (
            <>
              <Field label="Términos y condiciones">
                <Textarea
                  rows={4}
                  value={form.reparacionTerminosIngreso}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reparacionTerminosIngreso: e.target.value }))
                  }
                  placeholder="Párrafos separados por una línea en blanco."
                />
              </Field>
              <Field label="Aclaraciones">
                <Textarea
                  rows={4}
                  value={form.reparacionAclaracionesIngreso}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reparacionAclaracionesIngreso: e.target.value }))
                  }
                  placeholder="Párrafos separados por una línea en blanco."
                />
              </Field>
            </>
          )}
          {docTab === "presupuesto" && (
            <Field label="Términos y condiciones">
              <Textarea
                rows={4}
                value={form.reparacionTerminosPresupuesto}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reparacionTerminosPresupuesto: e.target.value }))
                }
                placeholder="Párrafos separados por una línea en blanco."
              />
            </Field>
          )}
          {docTab === "egreso" && (
            <>
              <Field label="Términos y condiciones">
                <Textarea
                  rows={4}
                  value={form.reparacionTerminosEgreso}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reparacionTerminosEgreso: e.target.value }))
                  }
                  placeholder="Párrafos separados por una línea en blanco."
                />
              </Field>
              <Field label="Aclaraciones">
                <Textarea
                  rows={4}
                  value={form.reparacionAclaracionesEgreso}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reparacionAclaracionesEgreso: e.target.value }))
                  }
                  placeholder="Párrafos separados por una línea en blanco."
                />
              </Field>
            </>
          )}
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
