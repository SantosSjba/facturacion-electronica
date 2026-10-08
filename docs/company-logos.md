# Logo por empresa

En el portal: **Empresas → seleccionar empresa → Resumen → Logo de la empresa**.
Los usuarios con `companies:read` pueden ver el logo. Para subirlo, reemplazarlo o eliminarlo se requiere `companies:write`.

## API

La integración usa la clave API de la organización. Crear una clave con los scopes `companies:read` para consultar y `companies:write` para subir/eliminar el logo. Las claves existentes conservan sus permisos; crear una nueva con estos scopes si se necesita esta función. Todos los endpoints también aceptan un JWT de usuario con el permiso correspondiente.

| Método | Ruta                              | Resultado                                                          |
| ------ | --------------------------------- | ------------------------------------------------------------------ |
| GET    | `/v1/companies/{company_id}/logo` | JSON `{logo, data_url}`; ambos `null` si no hay logo               |
| PUT    | `/v1/companies/{company_id}/logo` | Multipart con un archivo `file`; devuelve metadatos y vista previa |
| DELETE | `/v1/companies/{company_id}/logo` | `204`; elimina el logo de la configuración                         |

El portal dispone de las mismas operaciones en `/companies/{company_id}/logo`. Una empresa ajena a la organización autenticada devuelve `404`; los permisos insuficientes devuelven `403`.

```bash
curl -X PUT "$API_ORIGIN/v1/companies/$COMPANY_ID/logo" \
  -H "Authorization: Bearer $API_KEY" \
  -F "file=@logo.png"
```

```ts
import { FactosysClient } from "@factosys/sdk";

const client = new FactosysClient({ baseUrl: API_ORIGIN, apiKey: API_KEY });
await client.companies.putLogo(companyId, logoBlob, "logo.png");
const { logo, data_url } = await client.companies.getLogo(companyId);
await client.companies.deleteLogo(companyId);
```

El archivo debe ser PNG, JPG o WebP estático, de hasta **2 MB y 16 megapíxeles**. El servidor comprueba la firma binaria, decodifica el contenido y lo convierte a PNG de hasta 1200×1200, conservando la proporción y la transparencia y quitando metadatos. No se admiten SVG ni URLs remotas. `logo` contiene `content_type`, `size_bytes`, `width`, `height`, `sha256` y `updated_at`. `data_url` es una imagen incrustada lista para una etiqueta `<img>`; las respuestas no exponen rutas internas de almacenamiento y llevan `Cache-Control: private, no-store`.

## PDF e historial

Las nuevas facturas (`01`), boletas (`03`), notas de crédito (`07`) y notas de débito (`08`) guardan una referencia al logo configurado al emitir. El PDF incrusta los bytes de esa versión y no necesita conectarse a una URL pública. Reemplazar o eliminar el logo afecta las siguientes emisiones, incluso cuando un comprobante anterior aún espera generar su PDF. Una emisión sin logo sigue sin logo aunque se configure uno posteriormente.

Los PDF ya guardados se conservan, también frente a reintentos del trabajador. Los comprobantes anteriores a esta integración que aún no tienen PDF usan el logo actual en su primera generación. Las versiones anteriores de las imágenes permanecen en el almacenamiento privado para permitir la generación de documentos históricos; la eliminación del logo no destruye esas versiones.

El soporte de PDF disponible actualmente cubre `01`, `03`, `07` y `08`; esta función no agrega representaciones impresas para otros tipos. El logo se añade a la representación PDF, sin modificar el XML firmado. Para obtener el PDF visual usar `PDF_RI_MODE=playwright`; el modo `fake` sigue siendo un sustituto para pruebas.

## Instalación

Instalar dependencias con `pnpm install` y aplicar la migración con `pnpm db:migrate` (requiere `DATABASE_URL`). La migración `0015_company_logo` añade `companies.logo` y `documents.logo_snapshot`; se incluye reversión. La API usa el mismo almacenamiento S3/MinIO que los comprobantes. No se requiere un bucket público ni credenciales adicionales.

El procesamiento usa [Sharp](https://sharp.pixelplumbing.com/api-constructor/) para decodificar con límite de píxeles y re-encodear las imágenes.
