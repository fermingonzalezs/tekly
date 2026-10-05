import { LegalLayout, Lista, Seccion } from "@/components/legal/legal-layout";
import { EMPRESA, PLAZOS_DERECHOS } from "@/lib/legal";
import { legalMetadata } from "@/lib/legal-metadata";

export const metadata = legalMetadata(
  "Política de privacidad",
  "Cómo trata Tekly los datos personales: qué datos, para qué, con quién se comparten, cuánto tiempo y cómo ejercer tus derechos.",
  "/privacidad",
);

export default function PrivacidadPage() {
  return (
    <LegalLayout titulo="Política de privacidad">
      <Seccion titulo="1. Quién es responsable">
        <p>
          {EMPRESA.razonSocial}, CUIT {EMPRESA.cuit}, domicilio {EMPRESA.domicilio} («Tekly»), es
          responsable del tratamiento de los datos de las cuentas que usan el servicio. Contacto:{" "}
          {EMPRESA.email}.
        </p>
        <p>
          Tekly tiene dos roles distintos, según de qué datos se trate:
        </p>
        <Lista
          items={[
            <>
              <strong className="font-semibold">Responsable</strong>, respecto de los datos de las
              personas que se registran como usuarios (nombre, email, rol, registro de
              aceptación de estos textos).
            </>,
            <>
              <strong className="font-semibold">Encargado de tratamiento</strong>, respecto de los
              datos de los clientes finales que cada negocio carga en el sistema. El responsable de
              esos datos es el negocio (el «Cliente» de Tekly); Tekly solo los trata por su cuenta
              y bajo sus instrucciones, para prestar el servicio.
            </>,
          ]}
        />
      </Seccion>

      <Seccion titulo="2. Qué datos tratamos">
        <Lista
          items={[
            "Datos de cuenta: nombre, email, contraseña (almacenada de forma cifrada por el proveedor de autenticación), rol y organización.",
            "Datos que carga el negocio sobre sus clientes: nombre, teléfono, email, fecha de nacimiento (opcional), historial de compras, reparaciones y turnos, y los datos de los equipos (marca, modelo, IMEI/serie).",
            "Datos operativos del negocio: ventas, pagos, cajas, stock, proveedores y compras.",
            "Datos técnicos mínimos: cookies de sesión y registros de seguridad (ver la Política de cookies).",
          ]}
        />
      </Seccion>

      <Seccion titulo="3. Para qué los usamos">
        <Lista
          items={[
            "Prestar el servicio contratado y mantener las cuentas y los permisos por rol.",
            "Seguridad: autenticación, prevención de abuso y fraude (por ejemplo, el control anti-bots en los formularios de acceso).",
            "Comunicaciones del servicio (confirmación de cuenta, invitaciones, recuperación de contraseña, avisos de cambios).",
            "Soporte: el equipo de Tekly puede acceder a los datos de una organización únicamente cuando es necesario para resolver una consulta o incidente que el propio Cliente plantea.",
          ]}
        />
        <p>No vendemos datos personales ni los usamos para publicidad de terceros.</p>
      </Seccion>

      <Seccion titulo="4. Con quién los compartimos">
        <p>Usamos proveedores que tratan datos en nuestro nombre (subencargados):</p>
        <Lista
          items={[
            "Supabase: base de datos y autenticación (región de São Paulo, Brasil).",
            "Proveedor de hosting de la aplicación: [completar].",
            "Cloudflare Turnstile: verificación anti-bots en inicio de sesión, registro y recuperación de contraseña.",
            "Proveedor de envío de emails del servicio: [completar].",
          ]}
        />
        <p>
          Cada organización ve únicamente sus propios datos: el aislamiento se aplica a nivel de
          base de datos. Solo comunicamos datos a autoridades cuando una ley o una orden judicial
          lo exige.
        </p>
      </Seccion>

      <Seccion titulo="5. Transferencia internacional">
        <p>
          Los servidores de Supabase se encuentran fuera de la República Argentina (Brasil), y
          otros proveedores pueden operar desde otros países. Esas transferencias se realizan con
          garantías contractuales de protección adecuadas, conforme a la Ley 25.326.{" "}
          <em>[Confirmar con el asesor legal el mecanismo (cláusulas contractuales / consentimiento).]</em>
        </p>
      </Seccion>

      <Seccion titulo="6. Seguridad">
        <Lista
          items={[
            "Aislamiento de datos por organización mediante políticas de seguridad a nivel de fila (RLS).",
            "Cifrado en tránsito (HTTPS) y contraseñas almacenadas de forma cifrada.",
            "Acceso por roles dentro de cada organización (administrador, vendedor, técnico) y restricción de datos sensibles como costos y márgenes.",
          ]}
        />
        <p>
          Ningún sistema es infalible: ante un incidente que afecte datos personales, lo
          comunicaremos a los afectados y a la autoridad cuando corresponda.
        </p>
      </Seccion>

      <Seccion titulo="7. Cuánto tiempo conservamos los datos">
        <p>
          Mientras la cuenta esté activa. Si el Cliente da de baja su organización, conservamos los
          datos por <em>[30]</em> días para permitir la exportación y luego los eliminamos de forma
          definitiva en un plazo de <em>[90]</em> días, salvo que una obligación legal exija
          conservar algo por más tiempo. <em>[Plazos a confirmar.]</em>
        </p>
      </Seccion>

      <Seccion titulo="8. Tus derechos">
        <p>
          Podés ejercer los derechos de acceso, rectificación, actualización y supresión de tus
          datos escribiendo a {EMPRESA.email}. Respondemos el pedido de acceso dentro de{" "}
          {PLAZOS_DERECHOS.acceso} días hábiles y los de rectificación o supresión dentro de{" "}
          {PLAZOS_DERECHOS.rectificacionSupresion} días hábiles.
        </p>
        <p>
          Si sos cliente final de un negocio que usa Tekly, tenés que dirigir tu pedido primero a
          ese negocio, que es el responsable de tus datos; Tekly colaborará con él para
          atenderlo.
        </p>
        <p>
          La Agencia de Acceso a la Información Pública (AAIP), órgano de control de la Ley 25.326,
          tiene la atribución de atender las denuncias y reclamos de quienes vean afectados sus
          derechos de protección de datos personales.
        </p>
      </Seccion>

      <Seccion titulo="9. Menores de edad">
        <p>El servicio está dirigido a negocios y personas mayores de edad; no tratamos datos de menores de forma intencional.</p>
      </Seccion>

      <Seccion titulo="10. Cambios en esta política">
        <p>
          Podemos actualizar esta política. Informaremos los cambios sustanciales por email o
          dentro de la aplicación, y la versión vigente y su fecha figuran al inicio de esta página.
        </p>
      </Seccion>
    </LegalLayout>
  );
}
