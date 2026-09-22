import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { Env } from "../../infrastructure/config/env.schema";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-api-key"]',
  "*.password",
  "*.secret",
  "*.token",
  "*.apiKey",
  "*.api_key",
  "*.pfx",
  "*.p12",
  "*.privateKey",
] as const;

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const isDev = config.get("NODE_ENV", { infer: true }) === "development";
        return {
          pinoHttp: {
            level: config.get("LOG_LEVEL", { infer: true }),
            genReqId: (req: IncomingMessage, res: ServerResponse) => {
              const existing = req.headers["x-request-id"];
              const fromHeader = Array.isArray(existing) ? existing[0] : existing;
              const id =
                typeof fromHeader === "string" && fromHeader.length > 0
                  ? fromHeader
                  : ((req as IncomingMessage & { id?: string }).id ?? cryptoRandom());
              res.setHeader("x-request-id", id);
              return id;
            },
            redact: {
              paths: [...REDACT_PATHS],
              censor: "[Redacted]",
            },
            transport: isDev
              ? {
                  target: "pino-pretty",
                  options: { singleLine: true, colorize: true },
                }
              : undefined,
            autoLogging: {
              ignore: (req: IncomingMessage) => req.url === "/health" || req.url === "/ready",
            },
          },
        };
      },
    }),
  ],
})
export class LoggingModule {}

function cryptoRandom(): string {
  return globalThis.crypto.randomUUID();
}
