"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { Settings, UserPen, LogOut, Bug } from "lucide-react";
import { dotClass, rolLabel, rolTone } from "@/lib/status";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { signOutAction, reportarBugAction } from "@/app/(app)/actions";
import type { SessionUser } from "@/lib/auth/types";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((p) => p[0]!.toUpperCase());
  return letras.join("") || "?";
}

export function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const [reportando, setReportando] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Cuenta"
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-white transition-colors",
          open ? "bg-accent/90 ring-2 ring-accent/30" : "bg-accent",
        )}
      >
        {iniciales(user.nombre)}
      </button>

      {open && (
        <div className="animate-toast-in absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
          <div className="flex items-start gap-3 border-b border-neutral-100 px-4 py-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-semibold text-white">
              {iniciales(user.nombre)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-900">
                {user.nombre}
              </p>
              <p className="truncate text-xs text-neutral-400">{user.email}</p>
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    dotClass[rolTone[user.rol]],
                  )}
                />
                {rolLabel[user.rol]}
              </span>
            </div>
          </div>

          <div className="py-1">
            {user.rol === "admin" && (
              <Link
                href="/configuracion"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              >
                <Settings className="h-4 w-4" />
                Ajustes
              </Link>
            )}
            <Link
              href={user.rol === "admin" ? "/configuracion?tab=cuenta" : "/configuracion"}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
            >
              <UserPen className="h-4 w-4" />
              Cambiar datos
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                setReportando(true);
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
            >
              <Bug className="h-4 w-4" />
              Reportar un problema
            </button>
          </div>

          <div className="border-t border-neutral-100 py-1">
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      )}

      <ReportarBugDialog
        key={reportando ? "a" : "b"}
        open={reportando}
        onClose={() => setReportando(false)}
      />
    </div>
  );
}

function ReportarBugDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [descripcion, setDescripcion] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [pending, startTransition] = useTransition();

  function enviar() {
    startTransition(async () => {
      await reportarBugAction(descripcion);
      setEnviado(true);
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Reportar un problema"
      description="Contanos qué pasó -- lo revisamos apenas nos llega."
      footer={
        enviado ? (
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button size="sm" disabled={!descripcion.trim() || pending} onClick={enviar}>
              {pending ? "Enviando…" : "Enviar reporte"}
            </Button>
          </>
        )
      }
    >
      {enviado ? (
        <p className="py-4 text-center text-sm text-neutral-600">
          Gracias, ya lo tenemos anotado.
        </p>
      ) : (
        <Textarea
          rows={5}
          autoFocus
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="¿Qué esperabas que pasara y qué pasó en cambio?"
        />
      )}
    </Dialog>
  );
}
