/**
 * Apply pending SQL migrations from drizzle/migrations.json.
 * Usage: DATABASE_URL=... node ./scripts/migrate.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const drizzleDir = join(packageRoot, "drizzle");

function databaseUrl() {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    console.error("[db:migrate] DATABASE_URL is required");
    process.exit(1);
  }
  return url;
}

async function main() {
  const sql = postgres(databaseUrl(), { max: 1 });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS factosys_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    const journal = JSON.parse(
      readFileSync(join(drizzleDir, "migrations.json"), "utf8"),
    );

    for (const entry of journal) {
      const applied = await sql`
        SELECT 1 FROM factosys_migrations WHERE id = ${entry.id} LIMIT 1
      `;
      if (applied.length > 0) {
        console.log(`[db:migrate] skip ${entry.id} (already applied)`);
        continue;
      }
      const body = readFileSync(join(drizzleDir, entry.up), "utf8");
      console.log(`[db:migrate] apply ${entry.id}`);
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`
          INSERT INTO factosys_migrations (id) VALUES (${entry.id})
        `;
      });
    }
    console.log("[db:migrate] OK");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[db:migrate]", err);
  process.exit(1);
});
