/**
 * Idempotent demo seed.
 * Usage: DATABASE_URL=... node ./scripts/seed.mjs
 * Requires package build (dist/) or run via tsx — uses compiled dist.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const dist = join(here, "../dist");

function databaseUrl() {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    console.error("[db:seed] DATABASE_URL is required");
    process.exit(1);
  }
  return url;
}

async function main() {
  const { createDb, seedDemo } = require(join(dist, "index.js"));
  const db = createDb(databaseUrl());
  try {
    const result = await seedDemo(db);
    console.log("[db:seed] OK", result);
  } finally {
    await db.$client.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[db:seed]", err);
  process.exit(1);
});
