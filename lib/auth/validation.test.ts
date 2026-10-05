import { describe, expect, it } from "vitest";
import { signupSchema } from "./validation";

const base = {
  organizacionNombre: "Celulares Norte",
  nombre: "Lucía Paredes",
  email: "lucia@example.com",
  password: "una-clave-bien-larga",
  confirmPassword: "una-clave-bien-larga",
};

describe("signupSchema", () => {
  it("acepta el registro con los términos tildados", () => {
    expect(signupSchema.safeParse({ ...base, acepta: "on" }).success).toBe(true);
  });
  it("rechaza si no tildó los términos (ausente o vacío)", () => {
    for (const acepta of [null, undefined, "", "off"]) {
      const r = signupSchema.safeParse({ ...base, acepta });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toMatch(/Términos/);
    }
  });
});
