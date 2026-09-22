import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";

import { AppModule } from "./app.module";
import type { Env } from "./infrastructure/config/env.schema";
import { startOtelIfEnabled } from "./infrastructure/observability/otel";

async function bootstrap(): Promise<void> {
  await startOtelIfEnabled();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<Env, true>);
  const nodeEnv = config.get("NODE_ENV", { infer: true });
  const corsOrigins = config.get("CORS_ORIGINS", { infer: true });

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Request-Id"],
  });

  if (nodeEnv !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Factosys API")
      .setDescription(
        "Electronic invoicing API — CPE + GRE + Webhooks + PDF + Validez + Meta ruleset (S9)",
      )
      .setVersion("0.7.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, document);
  }

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
}

void bootstrap();
