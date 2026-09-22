import { hash } from "argon2";
import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import type { Db } from "../client";
import { catalogVersions } from "../schema/catalog-versions";
import { organizations } from "../schema/organizations";
import { userRoles } from "../schema/user-roles";
import { users } from "../schema/users";
import { seedRbacMatrix } from "./rbac-matrix";

/** Official Excel ruleset pin (docs/sunat-oficial). */
export const RULESET_VERSION = "2026-08-26";
export const RULESET_SHA256 =
  "cb5e871cfe3b81abea7faf25b156e5d35b21e8c4837979350919926612da73b6";
export const RULESET_ARTIFACT =
  "docs/sunat-oficial/04-esquemas-validacion/reglas-validacion-cpe-2026-08-26.xlsx";

export const DEMO_ORG_SLUG = "demo";
export const DEMO_OWNER_EMAIL = "owner@demo.local";
/** Dev-only password for demo owner — never use in production. */
export const DEMO_OWNER_PASSWORD = "DemoOwner!2026";

export const DEMO_VIEWER_EMAIL = "viewer@demo.local";
/** Dev-only password for demo viewer — never use in production. */
export const DEMO_VIEWER_PASSWORD = "DemoViewer!2026";

/**
 * Idempotent demo seed: organization `demo`, catalog ruleset, RBAC matrix, owner + viewer.
 * No API key secrets.
 */
export async function seedDemo(db: Db): Promise<{
  organizationId: string;
  catalogVersionId: string;
  ownerUserId: string;
  viewerUserId: string;
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

  const { roleIds } = await seedRbacMatrix(db);

  const existingUser = await db
    .select()
    .from(users)
    .where(
      and(eq(users.organizationId, organizationId), eq(users.email, DEMO_OWNER_EMAIL)),
    )
    .limit(1);

  let ownerUserId = existingUser[0]?.id;
  if (!ownerUserId) {
    ownerUserId = uuidv7();
    const passwordHash = await hash(DEMO_OWNER_PASSWORD);
    await db.insert(users).values({
      id: ownerUserId,
      organizationId,
      email: DEMO_OWNER_EMAIL,
      name: "Demo Owner",
      passwordHash,
      status: "active",
    });
  }

  const ownerRoleId = roleIds.owner;
  const hasRole = await db
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, ownerUserId), eq(userRoles.roleId, ownerRoleId)))
    .limit(1);
  if (hasRole.length === 0) {
    await db.insert(userRoles).values({ userId: ownerUserId, roleId: ownerRoleId });
  }

  const existingViewer = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.organizationId, organizationId),
        eq(users.email, DEMO_VIEWER_EMAIL),
      ),
    )
    .limit(1);

  let viewerUserId = existingViewer[0]?.id;
  if (!viewerUserId) {
    viewerUserId = uuidv7();
    const passwordHash = await hash(DEMO_VIEWER_PASSWORD);
    await db.insert(users).values({
      id: viewerUserId,
      organizationId,
      email: DEMO_VIEWER_EMAIL,
      name: "Demo Viewer",
      passwordHash,
      status: "active",
    });
  }

  const viewerRoleId = roleIds.viewer;
  const hasViewerRole = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, viewerUserId),
        eq(userRoles.roleId, viewerRoleId),
      ),
    )
    .limit(1);
  if (hasViewerRole.length === 0) {
    await db.insert(userRoles).values({
      userId: viewerUserId,
      roleId: viewerRoleId,
    });
  }

  return { organizationId, catalogVersionId, ownerUserId, viewerUserId };
}
