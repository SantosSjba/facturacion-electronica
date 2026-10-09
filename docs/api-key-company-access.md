# Claves de integración por empresa

Una API key pertenece administrativamente a una organización y solo autoriza una lista explícita de sus empresas emisoras. Tener permisos como `documents:write` no da acceso a otras empresas. Las restricciones de empresa, permisos y entorno se aplican conjuntamente.

En **API keys → Nueva API key**, selecciona una empresa. El modo predeterminado es **Una empresa**. Para autorizar varias, selecciona **Varias empresas (avanzado)** y marca cada empresa. En la tabla se muestran las empresas autorizadas; **Asignar empresas** permite cambiarlas sin cambiar el secreto.

Cada envío sigue incluyendo `company_id`. Para una clave de Empresa A, enviar el ID de Empresa B devuelve 403, aunque ambas pertenezcan a la misma organización. Una clave autorizada para A y B puede indicar cualquiera de esos dos IDs.

## Crear o asignar acceso

Estos endpoints requieren JWT de consola y permiso `apikeys:manage`. Las API keys no pueden administrarse a sí mismas.

`GET /organizations/me/api-keys/companies` devuelve las empresas disponibles de la organización.

`POST /organizations/me/api-keys`:

```json
{
  "name": "ERP Empresa A",
  "scopes": ["documents:read", "documents:write"],
  "company_ids": ["UUID-DE-EMPRESA-A"],
  "environment_constraint": "production"
}
```

Para varias empresas se exige autorización explícita:

```json
{
  "name": "ERP grupo",
  "scopes": ["documents:read", "documents:write"],
  "access_mode": "multi",
  "company_ids": ["UUID-DE-EMPRESA-A", "UUID-DE-EMPRESA-B"]
}
```

`PATCH /organizations/me/api-keys/:id/companies` acepta `company_ids` y `access_mode`, con las mismas reglas. No permite modificar claves revocadas. Solo acepta empresas de la organización, sin duplicados y compatibles con el entorno de la clave. `GET /v1/whoami` devuelve `company_ids` y `environment_constraint` efectivos.

## Cobertura

- Emisión JSON y TXT, validación, previsualizaciones y QR.
- Consultas, trazas, XML, CDR, PDF, entregas y enlaces compartidos: el ID del documento se resuelve antes de autorizar.
- Datos de empresa, logotipo, series y credenciales.
- Listas de empresas y documentos filtradas por empresas autorizadas; documentos se filtran antes de paginar y también se valida el cursor.
- Webhooks de empresas autorizadas. Una API key no puede consultar, modificar ni crear webhooks globales de la organización. La consola JWT conserva la administración global.

La creación de empresas nuevas se realiza desde la consola JWT: una clave de empresa no puede autorizar emisores que todavía no existen. Las utilidades de certificados y conversión de archivos conservan sus permisos y requieren una clave con empresas asignadas.

La autorización se consulta en cada petición; cambios de asignación, eliminación de empresa o incompatibilidad del entorno se aplican sin regenerar secretos. El secreto solo se devuelve al crear y no se escribe en auditoría.

## Migración y despliegue

Aplicar `0019_api_key_companies.sql` mediante el migrador del proyecto antes de arrancar la nueva API. La migración añade `company_ids` vacío a las claves anteriores: **estas claves devolverán 403 hasta que un administrador asigne sus empresas**. No se elige automáticamente un emisor ni se mantiene acceso implícito a toda la organización.

Tras desplegar, entrar en **API keys → Asignar empresas**, o usar el endpoint PATCH con JWT. Los secretos existentes se conservan y vuelven a funcionar con la asignación elegida. Planificar esta asignación al desplegar para evitar interrupciones en las integraciones.

La migración se ha aplicado a PostgreSQL local de desarrollo; el despliegue en otros entornos debe ejecutar su propia migración.
