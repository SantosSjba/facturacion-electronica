# Diseño de contingencia física, offline y reseller

Fecha: 2026-10-09. Documento de diseño; no endpoints habilitados ni compromiso de implementación.

## Contingencia física

Caso candidato: emisor obligado a emitir electrónicamente que, por una causa aplicable al procedimiento SUNAT, utiliza documentos impresos autorizados. Debe validarse con el cliente el régimen, autorización y canal de comunicación vigente antes de implementar.

Crear un agregado separado `physical_contingency_reports`, con documentos físicos y series propias; no insertar comprobantes físicos como CPE electrónicos ni usar RC/RA como sustituto de la comunicación correspondiente. Identidad única por organización/empresa/tipo/serie/correlativo físico; detalle con fecha, adquirente, moneda, bases/tributos, motivo de contingencia y referencias de notas. Registrar autor, fuente, hashes, fecha de importación y evidencia del documento físico. Importes declarados se contrastan con el motor cuando el escenario fiscal lo permita; no se reconstruye una firma de un CPE que no existió.

Estados propuestos: borrador → validado → exportado/pendiente de comunicación → comunicado → confirmado/rechazado. `exportado` no significa recibido ni aceptado por SUNAT. El canal PEI y el formato oficial deben verificarse para el contribuyente; un primer flujo podría generar el archivo oficial validado y adjuntar manualmente la constancia. Un transporte automático solo se publica si hay operación oficial utilizable y pruebas; no se reutiliza `sendBill` por suposición. Plazos y calendario se parametrizan por régimen verificado, conservando su fuente y vigencia.

Permisos específicos de lectura/escritura/comunicación, API key, autorización de empresa, idempotencia de importación y reporte, auditoría, storage privado y constancias históricas. Pruebas de series físicas sin alterar el regex electrónico, límites/duplicados entre importaciones, notas relacionadas, diferencias de totales, vencimiento y aislamiento por organización. Registrar evidencia oficial y evitar reenviar reportes ambiguos sin reconciliación.

## Offline

Demanda actual: no identificada. Decisión: mantener emisión centralizada. Una interrupción del integrador puede gestionarse conservando solicitudes en su outbox local y reintentando con la misma clave; esa cola no constituye emisión fiscal offline y el integrador no debe imprimirla como aceptada.

Diseño si aparece demanda:

1. Outbox local durable y cifrado, ID estable del evento, payload/version/hash, empresa y serie. No guardar certificados ni credenciales SOL del servidor en terminales.
2. Sincronización central idempotente, autorización por empresa, revisión de fecha/escenario antes de reservar correlativo. Número asignado solo por servidor. Sin importar números temporales como números fiscales.
3. Si se exige numeración fiscal local, resolver primero reservas exclusivas de rangos/series por dispositivo, caducidad, revocación, contador durable, huecos y restauraciones. Un dispositivo restaurado no debe reusar números; nunca resolver un conflicto sobrescribiendo un documento aceptado.
4. Recepción central y aceptación fiscal como estados separados. Reintento tras pérdida de respuesta consulta el evento original, no emite nuevamente. Tombstones y ledger de sincronización conservan el resultado aun cuando expire la caché de idempotencia actual.
5. Pruebas de desconexión, reinicio, envío simultáneo, respuestas perdidas, replay tras expiración, reloj incorrecto, dispositivo revocado, rangos agotados y recuperación de backup.

Criterio de salida: demostrar sincronización sin duplicados y numeración segura con fallos reales antes de anunciar emisión offline. La contingencia física sigue su propio procedimiento fiscal.

## Reseller

Demanda actual: no identificada. Onboarding multiempresa ya existe dentro de una organización. Para terceros revendedores, mantener organizaciones separadas por cliente, vínculo explícito de administración delegado con scopes y auditoría, consentimiento/roles, cuotas/facturación y revocación. Nunca usar un RUC/organización compartido para evitar aislamiento. Credenciales y certificados permanecen cifrados por empresa; pruebas de listados, descargas, webhooks, shares y administración entre organizaciones son obligatorias.

Decisión: diferir el módulo comercial reseller hasta definir quién contrata, quién administra los RUC y cómo se delega/revoca acceso. No crear claves globales ni ampliar permisos actuales por inferencia.
