import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { configureBodyParsers } from "./infrastructure/http/body-parsers";

import { AppModule } from "./app.module";
import type { Env } from "./infrastructure/config/env.schema";
import { startOtelIfEnabled } from "./infrastructure/observability/otel";
import { MetaModule } from "./interfaces/http/meta/meta.module";
import { CompaniesModule } from "./interfaces/http/companies/companies.module";
import { DocumentsModule } from "./interfaces/http/v1/documents.module";
import { ValidationsModule } from "./interfaces/http/v1/validations.module";
import { WebhooksModule } from "./interfaces/http/v1/webhooks.module";
import { enrichInvoicingRequestBodies } from "./infrastructure/openapi/enrich-invoicing-bodies";

/** Public integrator docs: only electronic invoicing surface (/v1 + /meta). */
function keepInvoicingPaths(document: OpenAPIObject): OpenAPIObject {
  const paths = document.paths ?? {};
  const filtered: typeof paths = {};
  for (const [path, item] of Object.entries(paths)) {
    if (path.startsWith("/v1") || path.startsWith("/meta")) {
      filtered[path] = item;
    }
  }
  document.paths = filtered;

  const usedTags = new Set<string>();
  for (const item of Object.values(filtered)) {
    if (!item) continue;
    for (const method of Object.values(item)) {
      if (method && typeof method === "object" && "tags" in method) {
        const tags = (method as { tags?: string[] }).tags;
        tags?.forEach((t) => usedTags.add(t));
      }
    }
  }
  if (document.tags) {
    document.tags = document.tags.filter((t) => usedTags.has(t.name));
  }
  return document;
}

async function bootstrap(): Promise<void> {
  await startOtelIfEnabled();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  configureBodyParsers(app);
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<Env, true>);
  const corsOrigins = config.get("CORS_ORIGINS", { infer: true });

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Request-Id"],
  });

  // OpenAPI público: solo API de facturación electrónica (sin SaaS / auth / platform).
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Factosys API — Facturación electrónica")
    .setDescription(
      [
        "API de facturación electrónica SUNAT para integradores.",
        "",
        "## Qué incluye",
        "- CPE: facturas (01), boletas (03), notas de crédito/débito (07/08)",
        "- GRE (09/31), resumen diario (RC) y comunicaciones de baja (RA)",
        "- Consulta de documentos, XML firmado, CDR y PDF de representación impresa",
        "- Logo por empresa para personalizar los PDF (`/v1/companies/{companyId}/logo`)",
        "- Webhooks firmados (HMAC) y validación de CPE",
        "- Meta ruleset / catálogos (`GET /meta/ruleset`)",
        "",
        "## Autenticación",
        "Usa una **API key** de la organización:",
        "`Authorization: Bearer <api_key>`",
        "",
        "Scope típico de emisión: `documents:write`. Lectura: `documents:read`.",
        "Logo de empresa: `companies:read` para consultar y `companies:write` para subir o eliminar.",
        "",
        "## Idempotencia",
        "En `POST` de emisión envía siempre `Idempotency-Key` (única por empresa).",
        "Reintentos con la misma clave reutilizan la respuesta guardada.",
        "",
        "## Flujo típico",
        "1. Emitir (`POST /v1/invoices`, etc.) → documento en cola / estados SUNAT",
        "2. Consultar `GET /v1/documents/{id}` o webhook `document.status_changed`",
        "3. Descargar XML, CDR o PDF cuando el estado lo permita",
        "",
        "## Errores frecuentes",
        "- **401** — API key ausente o inválida",
        "- **403** — sin scope / permiso",
        "- **422** — validación de cuerpo o `Idempotency-Key` faltante",
        "- **429** — rate limit (revisa `Retry-After`)",
        "",
        "Integración: **REST + JSON**; 01/03/07/08 también aceptan **Factosys TXT v1** con `text/plain; charset=utf-8` por las mismas rutas e idempotencia (ver contrato Fase 6).",
        "No hace falta instalar un paquete npm: `@factosys/sdk` es interno del monorepo y aún no está publicado.",
        "",
        "**Fuera de alcance:** endpoints SaaS, plataforma y panel administrativo.",
      ].join("\n"),
    )
    .setVersion("0.7.0")
    .addTag("Facturas", "Emisión de facturas electrónicas (tipo 01).")
    .addTag("Boletas", "Emisión de boletas electrónicas (tipo 03).")
    .addTag("Notas de crédito", "Notas de crédito electrónicas (tipo 07).")
    .addTag("Notas de débito", "Notas de débito electrónicas (tipo 08).")
    .addTag("Comunicaciones de baja", "Comunicación de baja RA (SendSummary + consulta).")
    .addTag("Resúmenes diarios", "Resumen diario RC (pool automático + envío SUNAT).")
    .addTag("Guías de remisión", "GRE 09/31 (OAuth + sendDespatch + poll).")
    .addTag("Documentos", "Listado, detalle, traza, XML, CDR y PDF de documentos emitidos.")
    .addTag("Webhooks", "Endpoints de notificación y entregas firmadas HMAC.")
    .addTag("Validaciones", "Consulta de validez de CPE.")
    .addTag("Vistas previas", "Prevalidación local y XML/PDF sin firma ni consumo de correlativo.")
    .addTag("Empresas", "Configuración del logo de los comprobantes por empresa.")
    .addTag("Meta / Reglas", "Ruleset y pines de catálogo SUNAT (ADR-005).")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API Key",
        description: "API key de la organización. Enviar como `Authorization: Bearer <api_key>`.",
      },
      "bearer",
    )
    .build();
  const document = enrichInvoicingRequestBodies(
    keepInvoicingPaths(
      SwaggerModule.createDocument(app, swaggerConfig, {
        include: [DocumentsModule, WebhooksModule, ValidationsModule, MetaModule, CompaniesModule],
      }),
    ),
  );
  SwaggerModule.setup("docs", app, document);

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
}

void bootstrap();
