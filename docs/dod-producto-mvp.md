# DoD producto MVP: API de facturación

El MVP contiene la API, landing y paneles administrativos. Véase [alcance del producto](./alcance-producto.md).

## Cómo verificar

```bash
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm build
# Terminal A
pnpm --filter @factosys/api start:prod
# Terminal B
pnpm verify:dod
pnpm --filter @factosys/api test:e2e
```

| Capacidad de la API                 | Evidencia            |
| ----------------------------------- | -------------------- |
| Empresa, certificado y SOL cifrados | API e2e y verify:dod |
| Factura 01, estado, XML y CDR       | API e2e y verify:dod |
| Boleta 03 y resumen RC              | API e2e              |
| Notas 07/08 y baja RA               | API e2e              |
| GRE 09/31                           | API e2e              |
| Consulta CPE en modo Fake           | API e2e y verify:dod |
| Webhooks de estado                  | API e2e y verify:dod |
| PDF básico                          | API e2e y verify:dod |

La consola de emisión manual se retiró del alcance. La configuración de empresas, credenciales, series, API keys y webhooks se realiza en el panel cliente de saas-web.

Para los portales véase [DoD SaaS](./dod-saas-comercial.md). Los tests Fake no sustituyen la [verificación SUNAT real](./checklist-sandbox-beta.md).
