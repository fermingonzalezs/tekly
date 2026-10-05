import { LegalLayout, Seccion } from "@/components/legal/legal-layout";
import { EMPRESA } from "@/lib/legal";
import { legalMetadata } from "@/lib/legal-metadata";

export const metadata = legalMetadata(
  "Política de cookies",
  "Qué cookies y almacenamiento local usa Tekly, para qué y por cuánto tiempo.",
  "/cookies",
);

type Fila = { nombre: string; proposito: string; duracion: string; tercero: string };

/** Lo que usa la app hoy (verificado en el código): solo estrictamente
 * necesarias — no hay analytics ni publicidad. Si se suma una cookie o script
 * de terceros, actualizar esta tabla (plan 012). */
const FILAS: Fila[] = [
  {
    nombre: "sb-… (sesión de Supabase)",
    proposito: "Mantener tu sesión iniciada y proteger el acceso a la cuenta.",
    duracion: "Hasta 400 días, o hasta que cerrás sesión",
    tercero: "No (propia, servida por Tekly)",
  },
  {
    nombre: "tekly-remember",
    proposito: "Recordar si elegiste «Recordarme»; si no la elegiste, la sesión termina al cerrar el navegador.",
    duracion: "Persistente o de sesión, según tu elección",
    tercero: "No",
  },
  {
    nombre: "Cloudflare Turnstile",
    proposito: "Verificar que quien usa los formularios de acceso es una persona y no un bot.",
    duracion: "Durante la verificación",
    tercero: "Sí (Cloudflare)",
  },
  {
    nombre: "tekly:ui:… y tema (almacenamiento local)",
    proposito: "Recordar preferencias de interfaz, como mostrar u ocultar gráficos y tarjetas.",
    duracion: "Hasta que borrés los datos del navegador",
    tercero: "No",
  },
];

export default function CookiesPage() {
  return (
    <LegalLayout titulo="Política de cookies">
      <Seccion titulo="1. Qué son">
        <p>
          Las cookies son pequeños archivos que el sitio guarda en tu dispositivo. También usamos
          el almacenamiento local del navegador para recordar preferencias.
        </p>
      </Seccion>

      <Seccion titulo="2. Qué usamos">
        <p>
          Tekly usa <strong className="font-semibold">únicamente cookies estrictamente necesarias</strong>{" "}
          para que el servicio funcione y sea seguro. No usamos cookies de análisis ni de
          publicidad, por eso no te pedimos consentimiento para ellas.
        </p>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2.5">Nombre</th>
                <th className="px-4 py-2.5">Para qué</th>
                <th className="px-4 py-2.5">Duración</th>
                <th className="px-4 py-2.5">De terceros</th>
              </tr>
            </thead>
            <tbody>
              {FILAS.map((f) => (
                <tr key={f.nombre}>
                  <td className="px-4 py-2.5 font-medium">{f.nombre}</td>
                  <td className="px-4 py-2.5">{f.proposito}</td>
                  <td className="px-4 py-2.5">{f.duracion}</td>
                  <td className="px-4 py-2.5">{f.tercero}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="3. Cómo controlarlas">
        <p>
          Podés borrar o bloquear las cookies desde la configuración de tu navegador. Si bloqueás
          las necesarias, no vas a poder iniciar sesión ni usar el sistema.
        </p>
      </Seccion>

      <Seccion titulo="4. Cambios">
        <p>
          Si en el futuro sumamos cookies que no sean necesarias, actualizaremos esta página y te
          pediremos consentimiento antes de usarlas. Consultas: {EMPRESA.email}.
        </p>
      </Seccion>
    </LegalLayout>
  );
}
