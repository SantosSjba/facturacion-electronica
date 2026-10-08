import { createRequire } from "node:module";
import { sql } from "drizzle-orm";
import { localDatabaseUrl } from "./local-config.mjs";

const require = createRequire(import.meta.url);
const { createDb, seedDemo } = require("../dist/index.js");

async function main() {
  const db = createDb(localDatabaseUrl());
  try {
    await db.transaction(async (tx) => {
      const tables = await tx.execute(sql`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> 'factosys_migrations'
        ORDER BY tablename
      `);
      if (!tables.length) throw new Error("Run pnpm db:migrate before resetting");
      const identifiers = tables.map((table) =>
        sql`${sql.identifier("public")}.${sql.identifier(table.tablename)}`,
      );
      // All application tables are included; migration history is preserved.
      await tx.execute(sql`TRUNCATE TABLE ${sql.join(identifiers, sql`, `)} RESTART IDENTITY`);
      await seedDemo(tx);
    });
    console.log("[db:reset] Local data cleared; minimal seed recreated (2 accounts, 1 plan).");
  } finally {
    await db.$client.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error("[db:reset]", error);
  process.exitCode = 1;
});
