/**
 * Roll back the latest applied migration (or all with --all).
 * Usage: DATABASE_URL=... node ./scripts/migrate-down.mjs [--all]
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
    console.error("[db:migrate:down] DATABASE_URL is required");
    process.exit(1);
  }
  return url;
}

async function main() {
  const all = process.argv.includes("--all");
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
    const applied = await sql`
      SELECT id FROM factosys_migrations ORDER BY applied_at DESC
    `;
    if (applied.length === 0) {
      console.log("[db:migrate:down] nothing to roll back");
      return;
    }

    const byId = new Map(journal.map((e) => [e.id, e]));
    const toRoll = all ? applied : [applied[0]];

    for (const row of toRoll) {
      const entry = byId.get(row.id);
      if (!entry?.down) {
        console.error(`[db:migrate:down] missing down SQL for ${row.id}`);
        process.exit(1);
      }
      const body = readFileSync(join(drizzleDir, entry.down), "utf8");
      console.log(`[db:migrate:down] rollback ${row.id}`);
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`DELETE FROM factosys_migrations WHERE id = ${row.id}`;
      });
    }
    console.log("[db:migrate:down] OK");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[db:migrate:down]", err);
  process.exit(1);
});
