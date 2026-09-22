import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import type { Db } from "../client";
import { catalogVersions } from "../schema/catalog-versions";
import { organizations } from "../schema/organizations";

/** Official Excel ruleset pin (docs/sunat-oficial). */
export const RULESET_VERSION = "2026-08-26";
export const RULESET_SHA256 =
  "cb5e871cfe3b81abea7faf25b156e5d35b21e8c4837979350919926612da73b6";
export const RULESET_ARTIFACT =
  "docs/sunat-oficial/04-esquemas-validacion/reglas-validacion-cpe-2026-08-26.xlsx";

export const DEMO_ORG_SLUG = "demo";

/**
 * Idempotent demo seed: organization `demo` + default catalog_versions ruleset.
 * No secrets / API keys.
 */
export async function seedDemo(db: Db): Promise<{
  organizationId: string;
  catalogVersionId: string;
}> {
  const existingOrg = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, DEMO_ORG_SLUG))
    .limit(1);

  let organizationId = existingOrg[0]?.id;
  if (!organizationId) {
    organizationId = uuidv7();
    await db.insert(organizations).values({
      id: organizationId,
      name: "Factosys Demo",
      slug: DEMO_ORG_SLUG,
      status: "active",
    });
  }

  const existingCat = await db
    .select()
    .from(catalogVersions)
    .where(eq(catalogVersions.kind, "ruleset_excel"))
    .limit(5);

  const defaultRow = existingCat.find(
    (r) => r.version === RULESET_VERSION && r.isDefault,
  );
  let catalogVersionId = defaultRow?.id;

  if (!catalogVersionId) {
    const sameVersion = existingCat.find((r) => r.version === RULESET_VERSION);
    if (sameVersion) {
      catalogVersionId = sameVersion.id;
      if (!sameVersion.isDefault) {
        await db
          .update(catalogVersions)
          .set({ isDefault: false })
          .where(eq(catalogVersions.kind, "ruleset_excel"));
        await db
          .update(catalogVersions)
          .set({ isDefault: true })
          .where(eq(catalogVersions.id, catalogVersionId));
      }
    } else {
      await db
        .update(catalogVersions)
        .set({ isDefault: false })
        .where(eq(catalogVersions.kind, "ruleset_excel"));
      catalogVersionId = uuidv7();
      await db.insert(catalogVersions).values({
        id: catalogVersionId,
        kind: "ruleset_excel",
        version: RULESET_VERSION,
        sourceFilename: "reglas-validacion-cpe-2026-08-26.xlsx",
        sourceSha256: RULESET_SHA256,
        isDefault: true,
        artifactPath: RULESET_ARTIFACT,
        metadata: {},
      });
    }
  }

  return { organizationId, catalogVersionId };
}
