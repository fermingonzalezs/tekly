import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export const signupSchema = z.object({
  organizacionNombre: z.string().trim().min(2, "Nombre de la empresa muy corto"),
  nombre: z.string().trim().min(2, "Ingresá tu nombre"),
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

export const inviteSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  nombre: z.string().trim().min(2, "Ingresá un nombre"),
  rol: z.enum(["admin", "vendedor", "tecnico"]),
});
