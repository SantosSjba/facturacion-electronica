import { createHash } from "node:crypto";

import { hash } from "argon2";
import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import type { Db } from "../client";
import { catalogVersions } from "../schema/catalog-versions";
import { legalDocuments } from "../schema/legal-documents";
import { organizations } from "../schema/organizations";
import { userRoles } from "../schema/user-roles";
import { users } from "../schema/users";
import { seedRbacMatrix } from "./rbac-matrix";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

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

/** Platform org shell for seed-only platform operators (S12). */
export const PLATFORM_ORG_SLUG = "factosys-platform";
export const PLATFORM_ADMIN_EMAIL = "platform@factosys.local";
/** Dev-only password for platform admin — never use in production. */
export const PLATFORM_ADMIN_PASSWORD = "PlatformAdmin!2026";

/**
 * Idempotent demo seed: organization `demo`, catalog ruleset, RBAC matrix, owner + viewer.
 * Also seeds platform org + platform_superadmin user (dev only).
 * No API key secrets.
 */
export async function seedDemo(db: Db): Promise<{
  organizationId: string;
  catalogVersionId: string;
  ownerUserId: string;
  viewerUserId: string;
  platformOrgId: string;
  platformUserId: string;
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

  const existingPlatformOrg = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, PLATFORM_ORG_SLUG))
    .limit(1);

  let platformOrgId = existingPlatformOrg[0]?.id;
  if (!platformOrgId) {
    platformOrgId = uuidv7();
    await db.insert(organizations).values({
      id: platformOrgId,
      name: "Factosys Platform",
      slug: PLATFORM_ORG_SLUG,
      status: "active",
    });
  }

  const existingPlatformUser = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.organizationId, platformOrgId),
        eq(users.email, PLATFORM_ADMIN_EMAIL),
      ),
    )
    .limit(1);

  let platformUserId = existingPlatformUser[0]?.id;
  if (!platformUserId) {
    platformUserId = uuidv7();
    const passwordHash = await hash(PLATFORM_ADMIN_PASSWORD);
    await db.insert(users).values({
      id: platformUserId,
      organizationId: platformOrgId,
      email: PLATFORM_ADMIN_EMAIL,
      name: "Platform Superadmin",
      passwordHash,
      status: "active",
    });
  }

  const platformRoleId = roleIds.platform_superadmin;
  const hasPlatformRole = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, platformUserId),
        eq(userRoles.roleId, platformRoleId),
      ),
    )
    .limit(1);
  if (hasPlatformRole.length === 0) {
    await db.insert(userRoles).values({
      userId: platformUserId,
      roleId: platformRoleId,
    });
  }

  await seedLegalDraftsEsPe(db);

  return {
    organizationId,
    catalogVersionId,
    ownerUserId,
    viewerUserId,
    platformOrgId,
    platformUserId,
  };
}

const PRIVACY_ES_PE_BODY = `# Política de privacidad (borrador es-PE)

> **AVISO:** Este texto es un **placeholder** para desarrollo. No constituye asesoría legal ni texto final para producción. Debe ser revisado y aprobado por un abogado antes de publicarse.

## Resumen

Factosys trata datos personales necesarios para prestar el servicio de facturación electrónica en Perú.

## Checklist abogado

- [ ] Identidad y datos de contacto del responsable del tratamiento
- [ ] Bases legales (consentimiento / contrato / obligación legal SUNAT)
- [ ] Categorías de datos (identidad, contacto, RUC, CPE/GRE, logs)
- [ ] Finalidades y plazos de conservación
- [ ] Destinatarios / encargados (hosting, email, SUNAT)
- [ ] Transferencias internacionales (si aplica)
- [ ] Derechos ARCO / derechos del titular (Ley 29733 y normas aplicables)
- [ ] Cookies / tecnologías similares
- [ ] Medidas de seguridad (cifrado, acceso, backups)
- [ ] Procedimiento de notificación de brechas
- [ ] Jurisdicción y ley aplicable (Perú)
- [ ] Canal de contacto DPO / privacidad
`;

const TERMS_ES_PE_BODY = `# Términos de uso (borrador es-PE)

> **AVISO:** Este texto es un **placeholder** para desarrollo. No constituye asesoría legal ni texto final para producción. Debe ser revisado y aprobado por un abogado antes de publicarse.

## Resumen

Estos términos regulan el acceso y uso de la plataforma SaaS Factosys para emisión y gestión de comprobantes electrónicos.

## Checklist abogado

- [ ] Definiciones (Cuenta, Organización, Plan, CPE/GRE)
- [ ] Elegibilidad y capacidad legal del cliente
- [ ] Cuenta, credenciales y responsabilidad del usuario
- [ ] Licencia de uso del software (SaaS, no cesión)
- [ ] Obligaciones del cliente (datos SUNAT, certificados, veracidad)
- [ ] Obligaciones de Factosys (disponibilidad razonable, soporte)
- [ ] Planes, facturación, renovación y cancelación
- [ ] Limitación de responsabilidad y exclusiones
- [ ] Propiedad intelectual y confidencialidad
- [ ] Suspensión / terminación por abuso o incumplimiento
- [ ] Ley aplicable y jurisdicción (Perú)
- [ ] Procedimiento de cambios a los términos
`;

/**
 * Idempotent draft legal documents for locale es-PE (S12-LEGAL / FE-374).
 */
async function seedLegalDraftsEsPe(db: Db): Promise<void> {
  const drafts: Array<{
    code: string;
    version: number;
    title: string;
    bodyMd: string;
  }> = [
    {
      code: "privacy.es-PE",
      version: 1,
      title: "Política de privacidad (borrador)",
      bodyMd: PRIVACY_ES_PE_BODY,
    },
    {
      code: "terms.es-PE",
      version: 1,
      title: "Términos de uso (borrador)",
      bodyMd: TERMS_ES_PE_BODY,
    },
  ];

  for (const draft of drafts) {
    const existing = await db
      .select({ id: legalDocuments.id })
      .from(legalDocuments)
      .where(
        and(
          eq(legalDocuments.code, draft.code),
          eq(legalDocuments.version, draft.version),
        ),
      )
      .limit(1);
    if (existing[0]) {
      continue;
    }
    await db.insert(legalDocuments).values({
      id: uuidv7(),
      code: draft.code,
      version: draft.version,
      title: draft.title,
      bodyMd: draft.bodyMd,
      hash: sha256Hex(draft.bodyMd),
      status: "draft",
    });
  }
}
