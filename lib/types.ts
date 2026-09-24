export type Role = "admin" | "vendedor" | "tecnico";

export type TicketStatus =
  | "recibido"
  | "diagnosticado"
  | "presupuestado"
  | "aprobado"
  | "en_reparacion"
  | "esperando_repuesto"
  | "listo"
  | "entregado";

export type EquipoStatus =
  | "en_revision"
  | "disponible"
  | "reservado"
  | "vendido"
  | "extraviado";

/** Ítem del checklist de estado físico/funcional de un ticket de
 * reparación -- ver `CHECKLIST_ITEMS`/`checklistItemLabel` en
 * `lib/status.ts` para el orden y las etiquetas. */
export type ChecklistItemId =
  | "enciende"
  | "modulo"
  | "tactil"
  | "faceId"
  | "camaraFrontal"
  | "camaraTrasera"
  | "flash"
  | "altavoz"
  | "microfono"
  | "wifi"
  | "redSenal"
  | "pinCarga"
  | "botonPower"
  | "botonVolumen"
  | "botonSilencioAccion"
  | "sensorProximidad"
  | "trueTone"
  | "vidrioCamaraTrasera"
  | "vidrioTrasero"
  | "tornillos"
  | "bandejaSim"
  | "bateria";

export type EstadoChecklistItem = "bien" | "mal" | "na";

/** Relevamiento de estado del equipo -- al ingreso (`Ticket.checklistIngreso`)
 * y, por separado, al egreso (`Ticket.checklistEgreso`, se completa con un
 * botón aparte en el detalle del ticket, no junto con el alta). `color` va
 * suelto porque es un dato de identificación del equipo, no un chequeo
 * bien/mal/n-a. `items` es parcial: un ticket viejo (de antes de esta
 * feature) no tiene ninguno cargado. */
export type Checklist = {
  items: Partial<Record<ChecklistItemId, EstadoChecklistItem>>;
  color: string;
};

export type MedioPago =
  | "pesos"
  | "dolares"
  | "transferencia"
  | "cripto"
  | "tarjeta"
  | "canje";

/** `MedioPago` + "cuenta corriente" -- solo válido como `Pago.medio` (una
 * venta puede cobrarse a cuenta corriente; una `Caja`/`MovimientoCaja`/
 * `Compra` nunca, por eso esas tres siguen tipadas con `MedioPago`). */
export type MedioPagoVenta = MedioPago | "cuenta_corriente";

export type TurnoEstado = "pendiente" | "confirmado" | "cancelado";

/** Qué viene a hacer el cliente — define el color en el calendario. */
export type TurnoTipo = "compra" | "deja" | "retira" | "cotizar";

export type OtroCategoria =
  | "ipad"
  | "airpods"
  | "tablet"
  | "accesorio"
  | "otro";

export type Usuario = {
  id: string;
  nombre: string;
  alias: string;
  rol: Role;
  email: string;
  activo: boolean;
};

export type Cliente = {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  desde: string;
  /** Opcional -- solo para "Demografía de clientes" en el dashboard de
   * Clientes. Un cliente sin esto queda afuera de ese cálculo. */
  fechaNacimiento?: string;
  compras: number;
  reparaciones: number;
  gastadoUsd: number;
};

/** Opción liviana para los selectores de cliente (`ClientePicker`) --
 * no trae `compras`/`reparaciones`/`gastadoUsd` (no hacen falta para elegir). */
export type ClienteOpcion = { id: string; nombre: string; telefono: string; email: string };

/** Resultado de `ClientePicker`: un cliente ya existente, uno a crear (se
 * persiste recién cuando la acción del formulario que lo usa se confirma,
 * nunca al elegirlo -- así cancelar el diálogo no deja un cliente
 * fantasma), o uno "libre" (solo un nombre suelto, sin fila en `clientes`
 * -- únicamente donde el picker se usa con `allowLibre`, hoy sólo Turnos). */
export type ClienteSeleccion =
  | { tipo: "existente"; id: string; nombre: string }
  | { tipo: "nuevo"; nombre: string; telefono?: string }
  | { tipo: "libre"; nombre: string };

export type Servicio = {
  id: string;
  nombre: string;
  precioUsd: number;
  garantiaDias: number;
  activo: boolean;
};

/** Ítem cargado a un ticket ("Servicios asociados") -- tres orígenes:
 * `servicio` (catálogo de Reparaciones, `servicioId`), `repuesto`
 * (inventario, `repuestoId` + `cantidad`, descuenta stock al agregarlo y
 * lo repone si se quita -- sin precio de venta propio en `Repuesto`, se
 * carga a mano igual que un ítem libre) o `libre` (nombre + precio a
 * mano, sin ligar a nada). `origen` ausente = ticket de antes de esta
 * feature, se trata como `servicio`. */
export type TicketServicio = {
  origen?: "servicio" | "repuesto" | "libre";
  servicioId?: string;
  repuestoId?: string;
  nombre: string;
  precioUsd: number;
  /** Solo relevante para `origen: "repuesto"` -- en servicio/libre es 1. */
  cantidad?: number;
  /** Snapshot de `Servicio.garantiaDias` al momento de agregarlo -- sale en
   * la columna Garantía del "Ticket de egreso". `undefined` para repuesto/
   * libre (no tienen garantía propia en el catálogo). */
  garantiaDias?: number;
};

export type Ticket = {
  id: number;
  clienteId: string;
  cliente: string;
  /** Marca del equipo (ej. "Apple") -- el negocio solo repara iPhones así
   * que hoy es casi siempre el mismo valor, pero queda como campo propio
   * para el ticket de ingreso/egreso ("Datos del equipo"). */
  marca?: string;
  /** Modelo del equipo (ej. "iPhone 13 Pro 128GB") -- el campo ya existía,
   * se reutiliza como "Modelo" en "Datos del equipo" sin tocar cómo se usa
   * en el resto de la app (dashboard, analíticas, listados). */
  equipo: string;
  imei: string;
  falla: string;
  /** Reparación puntual que pide el cliente (ej. "Cambio de pantalla") --
   * distinto de `falla` (el problema que describe) y de `servicios` (el
   * presupuesto real una vez diagnosticado). */
  reparacionSolicitada?: string;
  /** Clave/código de desbloqueo del equipo, para que el técnico pueda
   * probarlo -- dato sensible, solo vive en el ticket. */
  claveCodigo?: string;
  /** Descripción libre del equipo al ingreso (golpes, funda, mica, etc.),
   * complementaria al checklist estructurado. */
  descripcionEquipo?: string;
  /** Checklist de estado físico/funcional relevado al ingreso -- se
   * completa al crear el ticket. `undefined` en tickets de antes de esta
   * feature. */
  checklistIngreso?: Checklist;
  /** Mismo checklist relevado al egreso -- se completa aparte, con un
   * botón en el detalle del ticket, no necesariamente junto con el cambio
   * de estado a "Entregado". */
  checklistEgreso?: Checklist;
  /** Medio(s) de pago registrados al entregar el equipo (pago simple o
   * dividido, mismo shape que `Venta.pagos`) -- `undefined` hasta que se
   * entrega. `compraId` (canje) no aplica acá, un ticket no genera compras. */
  pagos?: Pago[];
  tecnicoId: string | null;
  tecnico: string | null;
  estado: TicketStatus;
  ingreso: string;
  fechaISO: string;
  presupuestoUsd: number;
  servicios: TicketServicio[];
  nota?: string;
};

export type Turno = {
  id: string;
  /** 0 = hoy … 6 = dentro de una semana. */
  dayOffset: number;
  hora: string; // "HH:00", entre 09:00 y 20:00
  cliente: string;
  /** `null` si se agendó "sin registrar" (`ClientePicker` con `allowLibre`) --
   * `cliente` (el nombre) sigue completo igual, solo no hay fila real en
   * `clientes`. */
  clienteId: string | null;
  tipo: TurnoTipo;
  estado: TurnoEstado;
  ticketId: number | null;
  /** Equipos de inventario vinculados (turnos de compra/retira). */
  equipoIds?: string[];
  /** Seña o pago tomado al agendar (turnos de compra/retira). */
  pagos?: Pago[];
  nota?: string;
};

export type Equipo = {
  id: string;
  modelo: string;
  almacenamiento: string;
  color: string;
  imei: string;
  bateria: number;
  condicion: string;
  costoUsd: number;
  precioUsd: number;
  estado: EquipoStatus;
};

/** Historial de stock de un ítem de inventario (equipo, repuesto u otro) —
 * ingreso, cambios de estado, ajustes, etc. */
export type MovimientoTipo = "ingreso" | "egreso" | "edicion" | "baja" | "recuento";

export type Movimiento = {
  fecha: string;
  hora: string;
  detalle: string;
  usuario: string;
  tipo: MovimientoTipo;
};

/** Un `Movimiento` con el ítem resuelto -- para la vista consolidada de
 * "Movimientos" en /recuentos, que mezcla equipos/repuestos/otros en una
 * sola tabla (el historial por ítem, en su propio dialog, no necesita
 * esto). */
export type MovimientoItem = Movimiento & {
  itemTipo: "equipo" | "repuesto" | "otro";
  itemNombre: string;
};

/** Unidad individual de un producto serializado de "Otros" — cada una con
 * su propio serial, color y costo (pueden entrar en distintas tandas). */
export type OtroUnidad = {
  serial: string;
  color?: string;
  costoUsd: number;
};

/** Productos que no son iPhones ni repuestos: iPad, AirPods, tablets, etc. */
export type OtroItem = {
  id: string;
  nombre: string;
  descripcion?: string;
  categoria: OtroCategoria;
  precioUsd: number;
} & (
  | { serializado: true; unidades: OtroUnidad[] }
  | { serializado: false; cantidad: number; costoUsd: number }
);

export type Repuesto = {
  id: string;
  sku: string;
  nombre: string;
  modelo: string;
  stock: number;
  stockMin: number;
  costoUsd: number;
  proveedor: string;
};

/** Cómo quedó una diferencia del recuento al revisarla (admin-only, ver
 * `Recuento` abajo) -- "pendiente" hasta que alguien decide. Para equipos:
 * `confirmado` dice "sí, sigue extraviado", `restaurado` lo vuelve a
 * `disponible` (reapareció). Para repuestos/otros solo hay `ajustado`
 * (el stock pasa a lo contado) o `descartado` (fue un error de conteo,
 * ninguno toca el ítem real -- solo queda el registro). */
export type RecuentoResolucion = "pendiente" | "confirmado" | "restaurado" | "ajustado" | "descartado";

/** Una diferencia de un recuento de Equipos: lo que se esperaba (según el
 * estado guardado antes del recuento) vs. si se tildó como encontrado. Solo
 * entran acá los que NO coinciden -- un equipo que estaba disponible y se
 * encontró, o extraviado y seguía sin encontrarse, no es una diferencia. */
export type RecuentoLineaEquipo = {
  itemId: string;
  detalle: string;
  eraExtraviado: boolean;
  encontrado: boolean;
  resolucion: RecuentoResolucion;
};

/** Una diferencia de un recuento de Repuestos/Otros: cantidad que el
 * sistema tenía vs. la contada a mano. Solo entran los que no coinciden. */
export type RecuentoLineaCantidad = {
  itemId: string;
  detalle: string;
  cantidadSistema: number;
  cantidadContada: number;
  resolucion: RecuentoResolucion;
};

/** Una "sesión" de recuento de inventario: alguien cuenta (encontrado/no
 * encontrado para Equipos, cantidad real para Repuestos/Otros) y el
 * resultado queda `pendiente` -- no toca el stock todavía. Un admin lo
 * revisa después (`resolverRecuento`) línea por línea; recién ahí se
 * aplican los cambios reales y el recuento pasa a `revisado`. Si el
 * recuento no tuvo ninguna diferencia, se cierra solo como `revisado` sin
 * `revisadoPor` (nada que decidir). Mismo criterio que `Conciliacion` en
 * Cajas -- ver "Backend y multi-tenancy" en CLAUDE.md. */
export type Recuento = {
  id: string;
  tipo: "equipos" | "repuestos" | "otros";
  fecha: string;
  hora: string;
  responsable: string;
  estado: "pendiente" | "revisado";
  revisadoPor?: string;
  revisadoEn?: string;
  lineas: RecuentoLineaEquipo[] | RecuentoLineaCantidad[];
};

export type Proveedor = {
  id: string;
  nombre: string;
  contacto: string;
  telefono: string;
  rubro: string;
  ubicacion: string;
  repuestos: number;
};

export type VentaItem = {
  detalle: string;
  cantidad: number;
  precioUsd: number;
  costoUsd?: number;
  /** Si el ítem sale del inventario de equipos. */
  equipoId?: string;
  /** Origen elegido en "Nueva venta" (equipo del stock, servicio del
   * catálogo, producto de "Otros" o ítem libre) -- alimenta el mix de
   * categorías del dashboard (`ventasPorRubro` en `lib/dashboard.ts`).
   * Ventas creadas antes de este campo no lo tienen. */
  categoria?: "equipo" | "servicio" | "otro" | "libre";
  /** Repuestos consumidos por este ítem (solo tiene sentido en ítems de
   * servicio, ver "Nueva venta") -- descuenta stock al vender, se puede
   * devolver al borrar la venta. `nombre` es un snapshot, igual criterio
   * que `detalle`. */
  repuestos?: { repuestoId: string; nombre: string; cantidad: number }[];
};

/** Un medio de pago con su monto (pago simple o dividido) y la caja a la
 * que ingresa (`caja` = misma moneda que usa `MovimientoCaja`). */
export type Pago = {
  medio: MedioPagoVenta;
  montoUsd: number;
  caja: "usd" | "ars";
  /** Caja real elegida en "Nueva venta" (no aplica si `medio ===
   * "cuenta_corriente"`) -- reemplaza tener que adivinar a qué caja fue la
   * plata cuando hay más de una caja con el mismo medio. */
  cajaId?: string;
  /** % de recargo del medio al momento de la venta (snapshot, mismo
   * criterio que `Compra.cotizacion`) -- el monto real cobrado/movido es
   * `montoUsd * (1 + recargoPct/100)`, `montoUsd` sigue siendo la parte
   * del total de la venta que cubre este pago. */
  recargoPct?: number;
  /** Si `medio === "canje"`: `Compra.id` de la compra generada para el
   * equipo recibido (ver `CanjeEquipo` -- el detalle completo vive ahí,
   * no acá, para no duplicar/desincronizar). */
  compraId?: string;
};

/** Datos del equipo recibido en canje, cargados en el modal de "Nueva
 * venta" al elegir la caja de canje como medio de pago -- no se guardan en
 * `Venta.pagos`, solo viajan para crear la `Compra` vinculada
 * (`Pago.compraId`). */
export type CanjeEquipo = {
  marca?: string;
  equipo: string;
  imei?: string;
  checklist: Checklist;
  aclaraciones?: string;
};

/** Mayorista/minorista -- clasificación de la venta, no del cliente (el
 * mismo cliente puede comprar de una forma u otra según la ocasión). */
export type ModalidadVenta = "mayorista" | "minorista";

export type Venta = {
  id: string;
  fecha: string;
  fechaISO: string;
  clienteId: string;
  cliente: string;
  vendedorId: string;
  vendedor: string;
  /** Canal / origen de la venta (Local, WhatsApp, Instagram, …). */
  procedencia?: string;
  modalidad: ModalidadVenta;
  items: VentaItem[];
  totalUsd: number;
  /** 1+ medios con monto; la suma cubre el total. */
  pagos: Pago[];
  margenPct: number;
  tipo: "venta" | "reparacion";
  /** Si algún pago generó un movimiento de caja / cuenta corriente --
   * habilita el checkbox correspondiente al borrar (`lib/db/ventas.ts`). */
  tieneMovimientoCaja?: boolean;
  tieneMovimientoCC?: boolean;
};

/** Caja física/específica — puede haber varias por moneda (ej. "Mostrador"
 * y "Taller" en ARS, "Caja USD" y "Bóveda USD" en USD). */
export type Caja = {
  id: string;
  nombre: string;
  moneda: "usd" | "ars";
  /** Cajas desactivadas no aparecen para cargar movimientos nuevos, pero
   * conservan su historial. */
  activa: boolean;
  descripcion: string;
  /** "mar 2023" — igual formato que `Cliente.desde`. */
  creadaEl: string;
  /** Medio de pago fijo de esta caja — al elegir la caja en un movimiento
   * nuevo, el medio de pago se completa solo, no se vuelve a preguntar. */
  medioPago: MedioPago;
};

export type MovimientoCaja = {
  id: string;
  fecha: string; // "07 sep"
  hora: string;
  concepto: string;
  medioPago: MedioPago;
  tipo: "ingreso" | "egreso";
  /** Caja específica a la que pertenece; `monto` está en la moneda de esa caja. */
  cajaId: string;
  monto: number;
  /** Quién lo cargó — manual o generado automático desde una venta/pago. */
  usuario: string;
  /** `null` = todavía sin conciliar. Un movimiento ya archivado bajo una
   * conciliación no se puede eliminar (rompería la diferencia ya calculada
   * de esa conciliación pasada). */
  conciliacionId: string | null;
};

/** Una línea de conciliación: lo que el sistema esperaba tener en una caja
 * (neto de movimientos desde la última conciliación) vs. lo contado a mano. */
export type ConciliacionLinea = {
  cajaId: string;
  /** Neto acumulado en `movimientos` para esta caja desde la última conciliación. */
  montoSistema: number;
  /** Lo que se contó físicamente. */
  montoReal: number;
  comentario: string;
};

export type Conciliacion = {
  id: string;
  fecha: string;
  hora: string;
  responsable: string;
  lineas: ConciliacionLinea[];
  /** Comentario general de la conciliación, aparte del comentario de cada
   * línea/caja. */
  comentario?: string;
};

/** Movimiento de cuenta corriente ("fiado") de un cliente — `cargo` aumenta
 * la deuda, `pago` la reduce. Siempre en USD, como el resto de la app. */
export type MovimientoCC = {
  id: string;
  clienteId: string;
  fecha: string;
  hora: string;
  concepto: string;
  tipo: "cargo" | "pago";
  montoUsd: number;
  usuario: string;
};

export type CompraEstado = "pendiente" | "recibida";

export type CompraItem = {
  detalle: string;
  cantidad: number;
  costoUsd: number;
};

/** Compra — el espejo de `Venta` del lado del gasto. `origen` distingue una
 * compra a proveedor (de siempre, `proveedor` cargado a mano) de un canje
 * recibido en una venta (`origen === "canje"`, generada automáticamente
 * desde "Nueva venta" al elegir la caja de canje como medio de pago —
 * `clienteId`/`cliente` en vez de `proveedor`, `ventaId` referencia esa
 * venta, y `marca`/`imei`/`checklist`/`aclaraciones` documentan el equipo
 * recibido para el PDF firmable, ver "Ventas" en CLAUDE.md). */
export type Compra = {
  id: string;
  fecha: string;
  fechaISO: string;
  origen: "proveedor" | "canje";
  proveedor?: string;
  clienteId?: string;
  cliente?: string;
  /** `Venta.id` (formato `"V-123"`) que generó este canje. */
  ventaId?: string;
  items: CompraItem[];
  totalUsd: number;
  medioPago: MedioPago;
  estado: CompraEstado;
  /** Cuando `medioPago` es "pesos": el monto realmente pagado en ARS y la
   * cotización del dólar blue usada para convertirlo a `totalUsd` — se
   * guarda el tipo de cambio del momento en vez de recalcularlo con el
   * valor actual, para que el registro histórico no cambie con el tiempo. */
  montoArs?: number;
  cotizacion?: number;
  /** Solo `origen === "canje"`: datos del equipo recibido para el PDF
   * (checklist de ingreso, mismo shape que `Ticket.checklistIngreso` de
   * Reparaciones) y las aclaraciones cargadas en el modal. */
  marca?: string;
  imei?: string;
  checklist?: Checklist;
  aclaraciones?: string;
};

/** Regla que trae TODOS los equipos vendibles (disponible) de una o más
 * condiciones — ej. "A+, A" para armar una sección de gama
 * alta. Vacío = todas las condiciones. Se evalúa contra el stock actual
 * cada vez que se genera el mensaje: agregar la regla una vez alcanza,
 * no hay que volver a seleccionar equipo por equipo. */
export type DifusionReglaEquipo = {
  id: string;
  tipo: "equipo";
  condiciones: string[];
};

/** Regla que trae todos los productos de "Otros" de una categoría — ej.
 * todas las tablets. Igual de reusable que la de equipos. */
export type DifusionReglaOtro = {
  id: string;
  tipo: "otro";
  categoria: OtroCategoria;
};

/** Línea suelta sin origen en el inventario — el único caso donde precio y
 * costo se cargan a mano, porque no hay de dónde sacarlos automáticamente. */
export type DifusionManual = {
  id: string;
  tipo: "manual";
  texto: string;
  precioUsd: number;
  costoUsd?: number;
};

export type DifusionEntrada = DifusionReglaEquipo | DifusionReglaOtro | DifusionManual;

/** Un grupo con encabezado propio dentro del mensaje, ej. "IPHONE USADOS". */
export type DifusionSeccion = {
  id: string;
  nombre: string;
  /** Emoji que antecede a cada ítem de esta sección. */
  emoji: string;
  entradas: DifusionEntrada[];
};

/** Catálogo de productos armado para copiar y pegar en WhatsApp u otro
 * medio — no es una lista de contactos, es la plantilla del mensaje. */
export type ListaDifusion = {
  id: string;
  nombre: string;
  mensajeInicial: string;
  mensajeFinal: string;
  descuentoTipo: "ninguno" | "monto" | "porcentaje";
  /** USD si `descuentoTipo` es "monto"; % si es "porcentaje". */
  descuentoValor: number;
  secciones: DifusionSeccion[];
  creadaEl: string;
};
