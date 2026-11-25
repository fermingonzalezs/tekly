"use client";

import { Field, GrillaCampos, Input } from "@/components/ui/field";
import {
  maskFechaDDMMAAAA,
  validarBorradorCliente,
  type BorradorCliente,
} from "@/lib/clientes";

export {
  BORRADOR_CLIENTE_VACIO,
  datosDeBorrador,
  validarBorradorCliente,
  type BorradorCliente,
} from "@/lib/clientes";

export function CamposCliente({
  value,
  onChange,
  autoFocus,
}: {
  value: BorradorCliente;
  onChange: (b: BorradorCliente) => void;
  autoFocus?: boolean;
}) {
  const { errores } = validarBorradorCliente(value);
  const set = (k: keyof BorradorCliente, v: string) => onChange({ ...value, [k]: v });
  return (
    <GrillaCampos>
      <Field label="Nombre y apellido" className="sm:col-span-3">
        <Input
          value={value.nombre}
          onChange={(e) => set("nombre", e.target.value)}
          placeholder="Juan Pérez"
          autoFocus={autoFocus}
        />
      </Field>
      <Field label="Teléfono">
        <Input
          value={value.telefono}
          onChange={(e) => set("telefono", e.target.value)}
          placeholder="+54 9 11 …"
          inputMode="tel"
        />
      </Field>
      <Field label="Email" className="sm:col-span-2">
        <Input
          type="email"
          value={value.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="cliente@mail.com"
        />
      </Field>
      <Field label="Instagram" className="sm:col-span-2">
        <Input
          value={value.instagram}
          onChange={(e) => set("instagram", e.target.value)}
          placeholder="@usuario o link al perfil"
          aria-invalid={!!errores.instagram}
        />
        {errores.instagram && <p className="mt-1 text-xs text-red-600">{errores.instagram}</p>}
      </Field>
      <Field label="Nacimiento (opcional)">
        <Input
          value={value.nacimiento}
          onChange={(e) => set("nacimiento", maskFechaDDMMAAAA(e.target.value))}
          placeholder="DD/MM/AAAA"
          inputMode="numeric"
          maxLength={10}
          aria-invalid={!!errores.nacimiento}
        />
        {errores.nacimiento && <p className="mt-1 text-xs text-red-600">{errores.nacimiento}</p>}
      </Field>
    </GrillaCampos>
  );
}
