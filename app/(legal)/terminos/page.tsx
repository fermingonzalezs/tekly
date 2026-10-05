import { LegalLayout, Lista, Seccion } from "@/components/legal/legal-layout";
import { EMPRESA } from "@/lib/legal";
import { legalMetadata } from "@/lib/legal-metadata";

export const metadata = legalMetadata(
  "Términos y condiciones",
  "Condiciones de uso del servicio Tekly: cuentas, uso aceptable, datos del negocio, planes, responsabilidad y baja.",
  "/terminos",
);

export default function TerminosPage() {
  return (
    <LegalLayout titulo="Términos y condiciones">
      <Seccion titulo="1. Quiénes somos y qué es Tekly">
        <p>
          Tekly es un servicio de software en la nube para la gestión de negocios de venta y
          reparación de celulares y tecnología (inventario, ventas, reparaciones, turnos, cajas,
          clientes y analíticas). Lo presta {EMPRESA.razonSocial}, CUIT {EMPRESA.cuit}, con
          domicilio en {EMPRESA.domicilio} (en adelante, «Tekly»).
        </p>
        <p>
          Estos Términos regulan el uso del servicio por parte de la persona o empresa que crea una
          organización en Tekly (el «Cliente») y de los usuarios que el Cliente invita (los
          «Usuarios»). Al registrarte o usar el servicio aceptás estos Términos y la{" "}
          <a href="/privacidad" className="font-medium text-accent underline">Política de privacidad</a>.
        </p>
      </Seccion>

      <Seccion titulo="2. Cuentas y organizaciones">
        <Lista
          items={[
            "Cada organización tiene sus propios usuarios y datos; ninguna organización accede a los datos de otra.",
            "Un usuario pertenece a una sola organización. Quien crea la organización queda como administrador y es responsable de invitar usuarios, asignar roles (administrador, vendedor, técnico) y darlos de baja.",
            "Debés brindar datos verídicos y mantener la confidencialidad de tu contraseña. Sos responsable de la actividad realizada con tu cuenta; avisanos ante cualquier uso no autorizado.",
            "Debés ser mayor de edad y tener capacidad legal para contratar en nombre propio o de la empresa que representás.",
          ]}
        />
      </Seccion>

      <Seccion titulo="3. Uso aceptable">
        <p>El Cliente y sus Usuarios se comprometen a no:</p>
        <Lista
          items={[
            "usar el servicio para actividades ilícitas, incluida la venta o reparación de equipos de origen ilegítimo;",
            "intentar acceder a datos de otras organizaciones, vulnerar la seguridad o sobrecargar el servicio;",
            "cargar contenido que infrinja derechos de terceros o datos personales sin base legal para hacerlo;",
            "revender o ceder el acceso al servicio sin autorización de Tekly.",
          ]}
        />
      </Seccion>

      <Seccion titulo="4. Los datos del negocio">
        <p>
          Los datos que el Cliente carga en Tekly (clientes, ventas, stock, reparaciones, cajas y
          demás) son y seguirán siendo del Cliente. Tekly solo los trata para prestar el servicio,
          según la Política de privacidad, y le otorga al Cliente la posibilidad de exportarlos.
        </p>
        <p>
          El Cliente es el responsable de la legalidad de los datos de sus propios clientes que
          carga (consentimiento, información, derechos de los titulares) y Tekly actúa como su
          encargado de tratamiento. Los documentos que genera el sistema (recibos, comprobantes,
          garantías, tickets de reparación) son documentos del negocio, no de Tekly, y{" "}
          <strong className="font-semibold">no son facturas ni comprobantes fiscales</strong>:
          las obligaciones fiscales y de garantía frente a sus clientes corresponden al Cliente.
        </p>
      </Seccion>

      <Seccion titulo="5. Planes, precios y facturación">
        <p>
          Los planes y precios vigentes se informan en el sitio web antes de contratar. Los
          precios publicados pueden cambiar con aviso previo de al menos 30 días para los planes
          ya contratados. El período de prueba, si existe, no requiere medio de pago.{" "}
          <em>[Completar: moneda, ciclo de facturación, medios de pago y política de reembolsos una vez definido el pricing real.]</em>
        </p>
      </Seccion>

      <Seccion titulo="6. Disponibilidad, soporte y copias de seguridad">
        <p>
          Tekly procura mantener el servicio disponible de forma continua, pero no garantiza
          disponibilidad ininterrumpida ni ausencia de errores; pueden existir interrupciones por
          mantenimiento o por causas ajenas (por ejemplo, de los proveedores de infraestructura).
          El soporte se brinda por los canales informados en cada plan. Se realizan copias de
          seguridad de la base de datos, sin que ello implique una garantía de recuperación de
          cualquier dato en cualquier momento.
        </p>
      </Seccion>

      <Seccion titulo="7. Propiedad intelectual">
        <p>
          El software, la marca Tekly, el diseño y la documentación pertenecen a Tekly. Se otorga
          al Cliente una licencia limitada, no exclusiva e intransferible para usar el servicio
          mientras su cuenta esté activa. El Cliente conserva todos los derechos sobre sus datos y
          sobre su propia marca y logo.
        </p>
      </Seccion>

      <Seccion titulo="8. Responsabilidad">
        <p>
          El servicio se presta «tal cual». En la máxima medida permitida por la ley, Tekly no
          responde por lucro cesante, pérdida de oportunidades ni daños indirectos, ni por
          decisiones comerciales tomadas con base en los datos o analíticas del sistema. La
          responsabilidad total de Tekly frente al Cliente, si la hubiera, se limita al monto
          abonado por el Cliente en los últimos 12 meses. Nada de lo anterior limita los derechos
          irrenunciables que la Ley 24.240 de Defensa del Consumidor reconozca a quien sea
          consumidor.
        </p>
      </Seccion>

      <Seccion titulo="9. Suspensión y baja">
        <p>
          El Cliente puede dejar de usar el servicio y solicitar la baja de su organización en
          cualquier momento. Tekly puede suspender o dar de baja una cuenta por incumplimiento de
          estos Términos, falta de pago o uso que ponga en riesgo la seguridad del servicio,
          avisando por email cuando sea posible. Tras la baja, los datos se conservan por un plazo
          de gracia para permitir la exportación y luego se eliminan, según la Política de
          privacidad.
        </p>
      </Seccion>

      <Seccion titulo="10. Cambios en los Términos">
        <p>
          Podemos modificar estos Términos. Los cambios sustanciales se comunicarán con anticipación
          razonable (por email o dentro de la aplicación) y se pedirá aceptar la nueva versión para
          seguir usando el servicio. La versión vigente y su fecha figuran al inicio de esta
          página.
        </p>
      </Seccion>

      <Seccion titulo="11. Ley aplicable y jurisdicción">
        <p>
          Estos Términos se rigen por las leyes de la República Argentina. Para cualquier
          controversia serán competentes los tribunales ordinarios de la Ciudad Autónoma de Buenos
          Aires, sin perjuicio de la competencia que corresponda por ley al consumidor.{" "}
          <em>[Confirmar jurisdicción con el asesor legal.]</em>
        </p>
      </Seccion>

      <Seccion titulo="12. Contacto">
        <p>
          Consultas sobre estos Términos: {EMPRESA.email}.
        </p>
      </Seccion>
    </LegalLayout>
  );
}
