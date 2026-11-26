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

export type CelularStatus =
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
  /** Cualquier otra forma de cobro con caja propia (MercadoPago, cheque…). */
  | "otro"
  | "canje";

/** `MedioPago` + "cuenta corriente" -- solo válido como `Pago.medio` (una
 * venta puede cobrarse a cuenta corriente; una `Caja`/`MovimientoCaja`/
 * `Compra` nunca, por eso esas tres siguen tipadas con `MedioPago`). */
export type MedioPagoVenta = MedioPago | "cuenta_corriente";

/** Categoría de un `MovimientoCaja` de tipo "egreso" -- los ingresos no la
 * usan. `null` para movimientos de antes de este campo. */
export type CategoriaGasto =
  | "alquiler"
  | "sueldos"
  | "servicios"
  | "insumos_repuestos"
  | "impuestos"
  | "mantenimiento"
  | "otros";

export type TurnoEstado = "pendiente" | "confirmado" | "atendido" | "no_vino" | "cancelado";

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
  /** Usuario de Instagram normalizado (`lib/instagram.ts`), sin «@». */
  instagram?: string;
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
  | {
      tipo: "nuevo";
      nombre: string;
      telefono?: string;
      email?: string;
      instagram?: string;
      /** ISO `YYYY-MM-DD`. */
      fechaNacimiento?: string;
    }
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
  /** Costo unitario (U$) congelado al agregar el ítem: en un `repuesto`, el
   * `costoUsd` del repuesto en ese momento. Tickets anteriores no lo tienen
   * (se usa el costo actual del repuesto, ver `rentabilidadTicket`). */
  costoUsd?: number;
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

/** Ítem de un pedido (encargo): un producto, cuántos y a qué precio de venta
 * unitario en USD. Es un snapshot embebido en `pedidos.items` (jsonb), no una
 * relación viva. */
export type PedidoItem = {
  detalle: string;
  cantidad: number;
  precioUsd: number;
};

/** Pedido (encargo) de la Agenda: algo que no está en stock y se le entrega
 * a un cliente en `fechaEntrega`. Se dibuja en la fila «Todo el día» del
 * calendario. Tabla `pedidos` (`lib/db/pedidos.ts`). */
export type PedidoEstado = "pedido" | "llego" | "entregado" | "cancelado";

export type Pedido = {
  id: string;
  cliente: string;
  /** `null` si se cargó "sin registrar" (`ClientePicker` con `allowLibre`). */
  clienteId: string | null;
  /** Derivada de `items` en el server (`descripcionPedido`) — el usuario ya
   * no la escribe. Se mantiene porque el chip, el confirm de borrar y los
   * pedidos viejos (con `items = []`) la leen. */
  descripcion: string;
  /** Productos del pedido. Vacío en pedidos anteriores a los ítems. */
  items: PedidoItem[];
  /** Seña abonada en USD (`0` = no abonó). El total y el saldo no se
   * guardan: se calculan en `lib/pedidos.ts`. */
  senaUsd: number;
  /** Movimiento de caja de la seña (`movimientos_caja.pedido_id`): `monto`
   * en la moneda de la caja. `undefined` sin seña. */
  sena?: PedidoSena;
  /** `YYYY-MM-DD`. */
  fechaEntrega: string;
  estado: PedidoEstado;
  nota?: string;
};

export type PedidoSena = {
  movimientoId: string;
  cajaId: string;
  monto: number;
  cotizacion: number | null;
  /** Ya archivado bajo una conciliación: no se puede cambiar ni borrar. */
  conciliado: boolean;
};

export type Turno = {
  id: string;
  /** Fecha real `YYYY-MM-DD` (hora argentina). */
  fecha: string;
  /** Calculado contra hoy: 0 = hoy, negativo = pasado. Lo consumen el
   * dashboard, analíticas y la demo -- no se persiste. */
  dayOffset: number;
  hora: string; // "HH:MM", de a 30 min, entre 09:00 y 20:00
  /** Duración en minutos (default 30). */
  duracionMin: number;
  /** Quién atiende (`profiles`); `null` = sin asignar. */
  atiendeId: string | null;
  atiende: string | null;
  cliente: string;
  /** `null` si se agendó "sin registrar" (`ClientePicker` con `allowLibre`) --
   * `cliente` (el nombre) sigue completo igual, solo no hay fila real en
   * `clientes`. */
  clienteId: string | null;
  tipo: TurnoTipo;
  estado: TurnoEstado;
  ticketId: number | null;
  /** Celulares de inventario vinculados (turnos de compra). */
  celularIds?: string[];
  /** Ítems de "Otros" del carrito de un turno de compra -- snapshot
   * embebido, no una relación viva (mismo criterio que `CompraItem`). */
  itemsOtros?: TurnoOtroItem[];
  /** Seña o pago tomado al agendar (turnos de compra/retira). */
  pagos?: Pago[];
  nota?: string;
};

/** Ítem de "Otros" agregado al carrito de un turno de compra -- snapshot
 * embebido, no una relación viva (mismo criterio que `CompraItem`/
 * `VentaItem`). `serial` identifica la unidad puntual reservada si el
 * `OtroItem` de origen es serializado; `cantidad` es cuántas unidades se
 * descuentan si no lo es -- nunca los dos juntos. */
export type TurnoOtroItem = {
  otroId: string;
  nombre: string;
  precioUsd: number;
  serial?: string;
  cantidad?: number;
};

export type Celular = {
  id: string;
  modelo: string;
  almacenamiento: string;
  color: string;
  imei: string;
  bateria: number;
  condicion: string;
  costoUsd: number;
  precioUsd: number;
  estado: CelularStatus;
  /** Variante (SKU) a la que pertenece. El modelo/almacenamiento/condición
   * (y el color, si la variante lo define) salen de la variante. */
  varianteId: string;
  /** true = conserva su precio aunque cambie el de la variante; false = el
   * precio de la unidad es el de la variante. */
  precioPropio: boolean;
  /** Precio mayorista propio de la unidad; `null` = el de su variante. */
  precioMayoristaUsd?: number | null;
};

/** Qué tipo de unidad agrupa una variante. */
export type VarianteCategoria = "celular" | "notebook";

/** Variante (SKU): agrupa unidades iguales. Celulares: mismo modelo,
 * almacenamiento y condición, y opcionalmente el mismo color (color `""` =
 * cualquier color). Notebooks: modelo, memoria, almacenamiento y condición
 * (sin color). La lógica pura vive en `lib/variantes.ts`. */
export type Variante = {
  id: string;
  categoria: VarianteCategoria;
  /** Nombre libre del grupo al que pertenece (se renombra sin tocar el
   * modelo). */
  grupo: string;
  sku: string;
  modelo: string;
  almacenamiento: string;
  condicion: string;
  /** `""` = cualquier color: cada unidad carga el suyo. Siempre `""` en
   * notebooks. */
  color: string;
  /** RAM de las notebooks (`"16GB"`); `""` en celulares. */
  memoria: string;
  precioUsd: number;
  /** Precio para ventas mayoristas (U$), opcional. Lo hereda cada unidad que
   * no tenga uno propio (`precioMayoristaDe`, `lib/precios.ts`). */
  precioMayoristaUsd?: number | null;
  /** 0 = sin aviso de stock bajo. */
  stockMinimo: number;
  activa: boolean;
};

/** Condición de una notebook: las usadas además informan el estado de la
 * batería. */
export type NotebookCondicion = "nuevo" | "usado";

export type Notebook = {
  id: string;
  modelo: string;
  cpu: string;
  memoria: string;
  almacenamiento: string;
  pantalla: string;
  gpu: string;
  color: string;
  idioma: string;
  numeroSerie: string;
  garantia: string;
  notas: string;
  costoUsd: number;
  precioUsd: number;
  estado: CelularStatus;
  condicion: NotebookCondicion;
  /** Salud de la batería en % (0–100). Solo si `condicion === "usado"`;
   * `null` en las nuevas. */
  bateria: number | null;
  /** Variante (SKU): el modelo, memoria, almacenamiento y condición salen de
   * ella. */
  varianteId: string;
  /** true = conserva su precio aunque cambie el de la variante. */
  precioPropio: boolean;
  /** Precio mayorista propio de la unidad; `null` = el de su variante. */
  precioMayoristaUsd?: number | null;
};

/** Historial de stock de un ítem de inventario (equipo, repuesto u otro) —
 * ingreso, cambios de estado, ajustes, etc. */
export type MovimientoTipo = "ingreso" | "egreso" | "edicion" | "baja" | "recuento" | "ajuste";

export type Movimiento = {
  fecha: string;
  hora: string;
  detalle: string;
  usuario: string;
  tipo: MovimientoTipo;
};

/** Un `Movimiento` con el ítem resuelto -- para la vista consolidada de
 * "Movimientos" en /recuentos, que mezcla celulares/repuestos/otros en una
 * sola tabla (el historial por ítem, en su propio dialog, no necesita
 * esto). */
export type MovimientoItem = Movimiento & {
  itemTipo: "celular" | "notebook" | "repuesto" | "otro";
  itemNombre: string;
  /** Fecha real en ISO (`YYYY-MM-DD`), para agrupar en los gráficos -- la
   * `fecha` mostrada es `DD mes`, sin año. */
  fechaISO: string;
};

/** Estado de una unidad puntual de un "Otro" serializado -- misma semántica
 * que `CelularStatus` para celulares: una unidad reservada/vendida no vuelve a
 * ofrecerse. `undefined` = "disponible" (unidades de antes de este campo). */
export type OtroUnidadEstado = "disponible" | "reservado" | "vendido";

/** Unidad individual de un producto serializado de "Otros" — cada una con
 * su propio serial, color y costo (pueden entrar en distintas tandas). */
export type OtroUnidad = {
  serial: string;
  color?: string;
  costoUsd: number;
  estado?: OtroUnidadEstado;
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
 * `Recuento` abajo) -- "pendiente" hasta que alguien decide. Para celulares:
 * `confirmado` dice "sí, sigue extraviado", `restaurado` lo vuelve a
 * `disponible` (reapareció). Para repuestos/otros solo hay `ajustado`
 * (el stock pasa a lo contado) o `descartado` (fue un error de conteo,
 * ninguno toca el ítem real -- solo queda el registro). */
export type RecuentoResolucion = "pendiente" | "confirmado" | "restaurado" | "ajustado" | "descartado";

/** Una diferencia de un recuento de Celulares: lo que se esperaba (según el
 * estado guardado antes del recuento) vs. si se tildó como encontrado. Solo
 * entran acá los que NO coinciden -- un equipo que estaba disponible y se
 * encontró, o extraviado y seguía sin encontrarse, no es una diferencia. */
export type RecuentoLineaCelular = {
  itemId: string;
  detalle: string;
  eraExtraviado: boolean;
  encontrado: boolean;
  resolucion: RecuentoResolucion;
  /** Solo para `encontrado: false` -- qué pasó con el equipo, cargado al
   * tildar "no encontrado" en el recuento (ej. "lo tiene el técnico Dani
   * en el banco de trabajo", "se ve en la cámara que salió con un
   * cliente"). Ayuda a decidir la resolución sin tener que ir a preguntar. */
  comentario?: string;
};

/** Una diferencia de un recuento de Repuestos/Otros: cantidad que el
 * sistema tenía vs. la contada a mano. Solo entran los que no coinciden. */
export type RecuentoLineaCantidad = {
  itemId: string;
  detalle: string;
  cantidadSistema: number;
  cantidadContada: number;
  resolucion: RecuentoResolucion;
  /** Nota libre cargada junto a la cantidad real, en la fila de ese ítem del
   * modal de recuento (ej. "faltan 2, se ve que se rompieron al probarlos"). */
  comentario?: string;
};

/** Una "sesión" de recuento de inventario: alguien cuenta (encontrado/no
 * encontrado para Celulares, cantidad real para Repuestos/Otros) y el
 * resultado queda `pendiente` -- no toca el stock todavía. Un admin lo
 * revisa después (`resolverRecuento`) línea por línea; recién ahí se
 * aplican los cambios reales y el recuento pasa a `revisado`. Si el
 * recuento no tuvo ninguna diferencia, se cierra solo como `revisado` sin
 * `revisadoPor` (nada que decidir). Mismo criterio que `Conciliacion` en
 * Cajas -- ver "Backend y multi-tenancy" en CLAUDE.md. */
export type Recuento = {
  id: string;
  tipo: "celulares" | "repuestos" | "otros";
  fecha: string;
  hora: string;
  /** Fecha real en ISO (`YYYY-MM-DD`), para agrupar por mes en los gráficos
   * -- `fecha` es `DD mes`, sin año. */
  fechaISO: string;
  responsable: string;
  estado: "pendiente" | "revisado";
  revisadoPor?: string;
  revisadoEn?: string;
  lineas: RecuentoLineaCelular[] | RecuentoLineaCantidad[];
  /** Nota libre para todo el recuento, cargada una sola vez al guardarlo
   * (ej. "conteo hecho después de cerrar, con poca luz en el depósito") --
   * separada de `comentario`/`RecuentoLineaCelular.comentario`, que son por
   * ítem. Hoy solo la cargan Repuestos/Otros (ver `RecuentoModalDialog` en
   * inventario-client.tsx); Celulares sigue con su checklist inline. */
  comentarioGeneral?: string;
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
  /** Precio unitario **efectivo**: ya incluye la parte del descuento de la
   * venta que le tocó (ver `aplicarDescuentoVenta`). Un regalo va en 0. */
  precioUsd: number;
  /** Precio de lista, solo cuando el descuento de la venta cambió esta
   * línea (si no, `null`/ausente: el efectivo ES el de lista). */
  precioListaUsd?: number;
  /** Ítem de regalo (plan 026): sale de la venta y de los recibos, no
   * suma al total y conserva su costo. */
  regalo?: boolean;
  costoUsd?: number;
  /** Si el ítem sale del inventario de celulares. */
  celularId?: string;
  /** Si el ítem sale del inventario de notebooks. */
  notebookId?: string;
  /** Si el ítem sale de «Otros» (descuenta su stock) y, si es serializado,
   * la unidad vendida. */
  otroId?: string;
  otroSerial?: string;
  /** Origen elegido en "Nueva venta" (equipo del stock, servicio del
   * catálogo, producto de "Otros" o ítem libre) -- alimenta el mix de
   * categorías del dashboard (`ventasPorRubro` en `lib/dashboard.ts`).
   * Ventas creadas antes de este campo no lo tienen. */
  categoria?: "celular" | "notebook" | "servicio" | "otro" | "libre";
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
  /** Cotización usada al cobrar (solo pagos a una caja ARS). Snapshot, no se
   * recalcula: es la que se usó para el movimiento de caja. */
  cotizacion?: number;
  /** Pesos realmente cobrados (incluye `recargoPct`) = el `monto` del
   * movimiento de caja generado. Solo pagos a una caja ARS. */
  montoArs?: number;
  /** Si `medio === "canje"`: `Compra.id` de la compra generada para el
   * equipo recibido (ver `CanjeEquipo` -- el detalle completo vive ahí,
   * no acá, para no duplicar/desincronizar). No lleva `cajaId`: el canje
   * no es una caja ni genera movimiento de caja (plan 020). */
  compraId?: string;
  /** Si `medio === "canje"`: `Celular.id` del equipo que entró al
   * inventario `en_revision` con el valor acordado. Permite linkear al
   * celular desde el detalle de la venta y borrarlo con la venta. */
  celularId?: string;
};

/** Datos del equipo recibido en canje, cargados en el modal de "Nueva
 * venta" al elegir «Mercadería» como medio de pago -- no se guardan en
 * `Venta.pagos`, solo viajan para crear la `Compra` vinculada
 * (`Pago.compraId`) y el celular que entra al inventario
 * (`Pago.celularId`). */
export type CanjeEquipo = {
  /** Modelo tal cual (ej. «iPhone 13 Pro 128GB»): sin variante, el equipo no
   * entra al stock al vender (ver `lib/canje.ts`). */
  modelo: string;
  imei: string;
  color: string;
  /** Escala de `CONDICIONES_CELULAR` (NUEVO, A+, A, B+, B, C). */
  condicion: string;
  /** % de batería; no aplica (se guarda 100) si la condición es NUEVO. */
  bateria?: number;
  /** Detalles del equipo (rayones, faltantes, etc.). */
  detalles?: string;
  /** Si se hizo el testeo: con `false` no se guarda checklist. */
  testeo: boolean;
  checklist?: Checklist;
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
  /** Tienda / página que hizo la venta (negocios que manejan más de una
   * desde la misma cuenta). `undefined` = la tienda principal. */
  tiendaId?: string;
  tienda?: string;
  items: VentaItem[];
  totalUsd: number;
  /** Diferencia total aplicada a la venta, firmada: >0 descuento, <0
   * recargo (0/ausente en las viejas). Ya está prorrateada en
   * `items[].precioUsd`. */
  ajusteUsd?: number;
  /** La venta entera es un regalo: total 0, sin pagos, con los costos
   * conservados para la ganancia. */
  regalo?: boolean;
  /** 1+ medios con monto; la suma cubre el total, salvo `diferenciaUsd`. */
  pagos: Pago[];
  /** Lo que faltó cobrar y se aceptó igual al confirmar la venta (U$, ≥ 0;
   * 0/ausente = se cobró completo). El total y los ítems no cambian: es la
   * plata que no entró. */
  diferenciaUsd?: number;
  margenPct: number;
  tipo: "venta" | "reparacion";
  /** Si algún pago generó un movimiento de caja / cuenta corriente --
   * habilita el checkbox correspondiente al borrar (`lib/db/ventas.ts`). */
  tieneMovimientoCaja?: boolean;
  tieneMovimientoCC?: boolean;
  /** Transitorio (no se persiste): aviso para mostrar al usuario después
   * de crear la venta, ej. el IMEI del canje ya existía y el celular se
   * cargó sin IMEI (plan 020). */
  avisoCanje?: string;
};

/** Tienda / página extra de la organización (tabla `tiendas`). La tienda
 * principal no es una fila: es el nombre de la organización. */
export type Tienda = { id: string; nombre: string };

/** Elección del campo «Tienda» de Nueva venta. `nueva` se crea recién
 * cuando la venta se confirma (mismo criterio diferido que `ClienteSeleccion`). */
export type TiendaSeleccion =
  | { tipo: "principal" }
  | { tipo: "existente"; id: string }
  | { tipo: "nueva"; nombre: string };

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
  /** % que se suma a lo que se cobra en esta caja (comisión de tarjeta, etc.).
   * Se snapshotea en `Pago.recargoPct` al confirmar. 0 = sin recargo. */
  recargoPct: number;
};

export type MovimientoCaja = {
  id: string;
  fecha: string; // "07 sep"
  /** "2026-09-07" — para filtrar/agrupar por fecha: la `fecha` display no
   * trae año (`new Date("07 sep")` parsea a 2001, no al año actual).
   * Mismo patrón que `Venta.fechaISO`/`Compra.fechaISO`. */
  fechaISO: string;
  hora: string;
  concepto: string;
  medioPago: MedioPago;
  tipo: "ingreso" | "egreso";
  /** Solo tiene sentido en egresos -- `null` en ingresos y en egresos de
   * antes de este campo. */
  categoria: CategoriaGasto | null;
  /** Caja específica a la que pertenece; `monto` está en la moneda de esa caja. */
  cajaId: string;
  monto: number;
  /** Dólar (ARS por USD) del momento en que se registró -- snapshot, nunca
   * se recalcula. Es lo que permite pasar a USD un movimiento de una caja
   * en pesos sin usar el blue de hoy. `null` en movimientos anteriores a
   * esta columna (no se reconstruye) y también en cajas USD viejas. */
  cotizacion: number | null;
  /** Ticket de Reparaciones que generó este ingreso (cobro al entregar el
   * equipo) -- `null` en movimientos manuales o de ventas/compras. Es lo
   * que permite medir "cobrado" por reparaciones en Analíticas. */
  ticketId: number | null;
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
  /** "2026-09-07" -- para filtrar por período (la `fecha` display no trae año). */
  fechaISO: string;
  hora: string;
  concepto: string;
  tipo: "cargo" | "pago";
  montoUsd: number;
  /** Ticket que generó este cargo (entrega de un equipo a cuenta corriente). */
  ticketId: number | null;
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
 * desde "Nueva venta" al cobrar con «Mercadería» — `clienteId`/`cliente`
 * en vez de `proveedor`, `ventaId` referencia esa venta, y
 * `marca`/`imei`/`checklist`/`aclaraciones` documentan el equipo recibido
 * para el PDF firmable; el equipo además entra al inventario como celular
 * `en_revision` (`Pago.celularId`), ver "Ventas" en CLAUDE.md). */
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
  /** Solo `origen === "proveedor"`: caja de la que salió el pago -- ver
   * `Pago.cajaId` en Venta para el mismo patrón (un medio puede tener más
   * de una caja activa, hace falta saber cuál). `undefined` en compras
   * viejas (creadas antes de este campo) y siempre en compras `canje`. */
  cajaId?: string;
  estado: CompraEstado;
  /** Cuando el pago salió en pesos (medio `pesos` o una caja en ARS): el
   * monto realmente pagado en ARS y la cotización del dólar blue usada para
   * la conversión -- se guarda el tipo de cambio del momento en vez de
   * recalcularlo con el valor actual, para que el registro histórico no
   * cambie con el tiempo. */
  montoArs?: number;
  cotizacion?: number;
  /** Solo `origen === "canje"`: datos del equipo recibido para el PDF
   * (checklist de ingreso, mismo shape que `Ticket.checklistIngreso` de
   * Reparaciones) y las aclaraciones cargadas en el modal. */
  marca?: string;
  imei?: string;
  checklist?: Checklist;
  /** En canje: los «Detalles» del equipo. */
  aclaraciones?: string;
  /** Solo canje: datos del equipo recibido (columnas `canje_*`). Compras de
   * canje anteriores a esto no los tienen (el modelo sale de `items[0]`). */
  canjeModelo?: string;
  canjeColor?: string;
  canjeCondicion?: string;
  canjeBateria?: number;
  canjeTesteado?: boolean;
  /** Solo `origen === "canje"`: `Celular.id` del equipo una vez que pasó al
   * inventario (celular con `compra_id` = esta compra; en canjes viejos,
   * `Pago.celularId` de la venta). `undefined` = «sin ingresar». */
  celularId?: string;
  /** Plan 025: la compra creó stock al guardarse (`compra_items` tiene el
   * vínculo con cada unidad). `false` = gasto/historial, como siempre. */
  subeStock?: boolean;
  /** Envío, flete, comisiones: ya prorrateados en el costo de cada ítem. */
  costosAdicionalesUsd?: number;
  notas?: string;
};

/** Un renglón de una compra que subió al stock (tabla `compra_items`): el
 * historial «Ingresos» de Compras / Ingresos. `costoUsd` es el unitario con
 * su parte de los costos adicionales. */
export type IngresoStock = {
  id: string;
  compraId: string;
  fecha: string;
  fechaISO: string;
  tipo: "celular" | "notebook" | "repuesto" | "otro";
  detalle: string;
  cantidad: number;
  costoUsd: number;
  serie?: string;
  proveedor?: string;
  usuario?: string;
  celularId?: string;
  notebookId?: string;
  repuestoId?: string;
  otroId?: string;
};

/** Regla que trae TODOS los celulares vendibles (disponible) de una o más
 * condiciones — ej. "A+, A" para armar una sección de gama
 * alta. Vacío = todas las condiciones. Se evalúa contra el stock actual
 * cada vez que se genera el mensaje: agregar la regla una vez alcanza,
 * no hay que volver a seleccionar equipo por equipo. */
export type DifusionReglaCelular = {
  id: string;
  tipo: "celular";
  condiciones: string[];
};

/** Regla que trae TODAS las notebooks disponibles de una o más condiciones
 * (`nuevo` / `usado`). Vacío = ambas. Se evalúa contra el stock actual. */
export type DifusionReglaNotebook = {
  id: string;
  tipo: "notebook";
  condiciones: NotebookCondicion[];
};

/** Regla que trae todos los productos de "Otros" de una categoría — ej.
 * todas las tablets. Igual de reusable que la de celulares. */
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

export type DifusionEntrada =
  | DifusionReglaCelular
  | DifusionReglaNotebook
  | DifusionReglaOtro
  | DifusionManual;

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

/** Respuesta de un reporte propio ya resuelto (campanita de notificaciones). */
export type ResolucionReporte = {
  id: string;
  /** Lo que reportó el usuario. */
  descripcion: string;
  /** Lo que se arregló (lo escribe el admin de plataforma). */
  respuesta: string;
  resueltoAt: string;
  visto: boolean;
};
