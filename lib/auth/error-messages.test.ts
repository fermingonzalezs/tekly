import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/lib/auth/error-messages";

describe("authErrorMessage", () => {
  it("credenciales inválidas", () => {
    expect(authErrorMessage("Invalid login credentials")).toBe(
      "Email o contraseña incorrectos",
    );
  });

  it("email sin confirmar", () => {
    expect(authErrorMessage("Email not confirmed")).toBe(
      "Confirmá tu cuenta desde el mail que te enviamos",
    );
  });

  it("rate limit (email y request)", () => {
    expect(authErrorMessage("Email rate limit exceeded")).toBe(
      "Demasiados intentos, esperá un momento y volvé a intentar",
    );
    expect(authErrorMessage("Over request rate limit")).toBe(
      "Demasiados intentos, esperá un momento y volvé a intentar",
    );
  });

  it("usuario desactivado (ban de Supabase)", () => {
    expect(authErrorMessage("User is banned")).toBe("Esta cuenta fue desactivada");
  });

  it("insensible a mayúsculas", () => {
    expect(authErrorMessage("INVALID LOGIN CREDENTIALS")).toBe(
      "Email o contraseña incorrectos",
    );
  });

  it("fallback para mensajes desconocidos", () => {
    expect(authErrorMessage("Database error saving new user")).toBe(
      "Ocurrió un error, intentá de nuevo",
    );
  });
});
