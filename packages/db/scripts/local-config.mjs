import { existsSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

/** Public development credentials must only be seeded into the Compose database. */
export function localDatabaseUrl() {
  const envPath = fileURLToPath(new URL("../../../.env", import.meta.url));
  if (existsSync(envPath)) process.loadEnvFile(envPath);
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required; configure the root .env");
  const url = new URL(value);
  if (
    process.env.NODE_ENV === "production" ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.port !== "5433" || url.pathname !== "/factosys"
  ) {
    throw new Error("Development seed/reset is restricted to local Compose: localhost:5433/factosys");
  }
  return value;
}
