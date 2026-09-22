import { z } from "zod";

const DEFAULT_DATABASE_URL =
  "postgresql://factosys:factosys@localhost:5433/factosys";
const DEFAULT_REDIS_URL = "redis://localhost:6379";
const DEFAULT_JWT_SECRET = "dev-only-change-me-jwt-access-secret-32b";
/** 32 zero bytes, base64 — DEV/TEST ONLY. */
const DEFAULT_CREDENTIALS_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
      "DATABASE_URL must be a postgres:// or postgresql:// URL",
    )
    .default(DEFAULT_DATABASE_URL),
  REDIS_URL: z.string().min(1).default(DEFAULT_REDIS_URL),
  JWT_ACCESS_SECRET: z.string().min(16).default(DEFAULT_JWT_SECRET),
  JWT_ACCESS_TTL_SEC: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SEC: z.coerce.number().int().positive().default(604_800),
  RATE_LIMIT_RPM_DEFAULT: z.coerce.number().int().positive().default(120),
  MINIO_ENDPOINT: z.string().url().default("http://localhost:9000"),
  MINIO_ACCESS_KEY: z.string().min(1).default("factosys"),
  MINIO_SECRET_KEY: z.string().min(1).default("factosysdev"),
  MINIO_BUCKET: z.string().min(1).default("factosys-dev"),
  MINIO_REGION: z.string().min(1).default("us-east-1"),
  CREDENTIALS_MASTER_KEY: z
    .string()
    .min(1)
    .default(DEFAULT_CREDENTIALS_MASTER_KEY)
    .refine((v) => {
      try {
        return Buffer.from(v, "base64").length === 32;
      } catch {
        return false;
      }
    }, "CREDENTIALS_MASTER_KEY must be base64-encoded 32 bytes"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates process env for Nest ConfigModule.
 * Throws a clear Error listing Zod issues when invalid.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}
