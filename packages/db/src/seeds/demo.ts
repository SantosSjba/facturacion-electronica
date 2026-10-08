import { createHash } from "node:crypto";

import { hash } from "argon2";
import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import type { Db } from "../client";
import { catalogVersions } from "../schema/catalog-versions";
import { legalDocuments } from "../schema/legal-documents";
import { notificationTemplates } from "../schema/notification-templates";
import { organizations } from "../schema/organizations";
import { plans } from "../schema/plans";
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
export const DEMO_OWNER_EMAIL = "cliente@factosysperu.com";
/** Dev-only password for demo owner — never use in production. */
export const DEMO_OWNER_PASSWORD = "DemoOwner!2026";

/** Platform org shell for seed-only platform operators (S12). */
export const PLATFORM_ORG_SLUG = "factosys-platform";
export const PLATFORM_ADMIN_EMAIL = "platform@factosysperu.com";
/** Dev-only password for platform admin — never use in production. */
export const PLATFORM_ADMIN_PASSWORD = "PlatformAdmin!2026";

/**
 * Idempotent demo seed: organization `demo`, catalog ruleset, RBAC matrix, owner.
 * Also seeds platform org + platform_superadmin user (dev only).
 * No API key secrets.
 */
export async function seedDemo(db: Pick<Db, "select" | "insert" | "update">): Promise<{
  organizationId: string;
  catalogVersionId: string;
  ownerUserId: string;
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
  await seedSignupNotificationTemplates(db);
  await seedSaasPlans(db);

  return {
    organizationId,
    catalogVersionId,
    ownerUserId,
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
 * Idempotent legal documents for locale es-PE (S12-LEGAL / S15-ONB).
 * Seeded as published so onboarding gate can accept them (S16 adds admin publish UI).
 */
async function seedLegalDraftsEsPe(db: Pick<Db, "select" | "insert" | "update">): Promise<void> {
  const drafts: {
    code: string;
    version: number;
    title: string;
    bodyMd: string;
  }[] = [
    {
      code: "privacy.es-PE",
      version: 1,
      title: "Política de privacidad",
      bodyMd: PRIVACY_ES_PE_BODY,
    },
    {
      code: "terms.es-PE",
      version: 1,
      title: "Términos de uso",
      bodyMd: TERMS_ES_PE_BODY,
    },
  ];

  const now = new Date();
  for (const draft of drafts) {
    const existing = await db
      .select({ id: legalDocuments.id, status: legalDocuments.status })
      .from(legalDocuments)
      .where(
        and(
          eq(legalDocuments.code, draft.code),
          eq(legalDocuments.version, draft.version),
        ),
      )
      .limit(1);
    if (existing[0]) {
      if (existing[0].status !== "published") {
        await db
          .update(legalDocuments)
          .set({
            status: "published",
            publishedAt: now,
            title: draft.title,
          })
          .where(eq(legalDocuments.id, existing[0].id));
      }
      continue;
    }
    await db.insert(legalDocuments).values({
      id: uuidv7(),
      code: draft.code,
      version: draft.version,
      title: draft.title,
      bodyMd: draft.bodyMd,
      hash: sha256Hex(draft.bodyMd),
      status: "published",
      publishedAt: now,
    });
  }
}

/**
 * Idempotent signup.* + plan.assigned email templates (S13-NOTIF / S14-PLAN).
 * Signup placeholders: {{company_name}}, {{ruc}}, {{contact_name}}, {{contact_email}}.
 * Plan placeholders: {{organization_name}}, {{plan_name}}, {{plan_code}}, {{status}}.
 */
async function seedSignupNotificationTemplates(db: Pick<Db, "select" | "insert" | "update">): Promise<void> {
  const templates: {
    code: string;
    subject: string;
    bodyMd: string;
  }[] = [
    {
      code: "signup.acuse",
      subject: "Recibimos tu solicitud — Factosys",
      bodyMd: `Hola {{contact_name}},

Gracias por solicitar acceso a Factosys. Hemos recibido la solicitud de **{{company_name}}** (RUC {{ruc}}).

Nuestro equipo la revisará y te contactaremos a {{contact_email}} cuando avancemos.

— Equipo Factosys`,
    },
    {
      code: "signup.received",
      subject: "[Factosys] Nueva solicitud de acceso: {{company_name}}",
      bodyMd: `Nueva solicitud de signup recibida.

- Empresa: {{company_name}}
- RUC: {{ruc}}
- Contacto: {{contact_name}} <{{contact_email}}>

Revisar en el panel plataforma.`,
    },
    {
      code: "signup.under_review",
      subject: "Tu solicitud está en revisión — Factosys",
      bodyMd: `Hola {{contact_name}},

La solicitud de **{{company_name}}** (RUC {{ruc}}) está en revisión.

Te avisaremos a {{contact_email}} cuando haya una decisión.

— Equipo Factosys`,
    },
    {
      code: "signup.approved",
      subject: "Solicitud aprobada — Factosys",
      bodyMd: `Hola {{contact_name}},

¡Buenas noticias! La solicitud de **{{company_name}}** (RUC {{ruc}}) fue aprobada.

Pronto recibirás instrucciones de onboarding en {{contact_email}}.

— Equipo Factosys`,
    },
    {
      code: "signup.rejected",
      subject: "Actualización sobre tu solicitud — Factosys",
      bodyMd: `Hola {{contact_name}},

Tras revisar la solicitud de **{{company_name}}** (RUC {{ruc}}), no podemos continuar en este momento.

Motivo: {{notes}}

Si tienes dudas, responde a este mensaje o escribe a soporte.

— Equipo Factosys`,
    },
    {
      code: "invite.owner",
      subject: "Activa tu cuenta owner — Factosys",
      bodyMd: `Hola {{contact_name}},

Tu organización **{{organization_name}}** ya está lista. Para activar tu cuenta de owner, crea tu contraseña en este enlace (válido {{ttl_hours}} h):

{{invite_url}}

Slug: \`{{organization_slug}}\`

— Equipo Factosys`,
    },
    {
      code: "invite.member",
      subject: "Te invitaron a {{organization_name}} — Factosys",
      bodyMd: `Hola {{contact_name}},

Te invitaron a unirte a **{{organization_name}}**. Crea tu contraseña en este enlace (válido {{ttl_hours}} h):

{{invite_url}}

Slug: \`{{organization_slug}}\`

— Equipo Factosys`,
    },
    {
      code: "plan.assigned",
      subject: "[Factosys] Plan asignado: {{plan_name}} → {{organization_name}}",
      bodyMd: `Se asignó un plan a una organización.

- Organización: {{organization_name}} ({{organization_slug}})
- Plan: {{plan_name}} (\`{{plan_code}}\`)
- Estado: {{status}}
- Org plan id: {{org_plan_id}}

— Equipo Factosys`,
    },
    {
      code: "plan.change_requested",
      subject:
        "[Factosys] Solicitud de cambio de plan: {{organization_name}} → {{requested_plan_name}}",
      bodyMd: `Una organización solicitó cambio de plan.

- Organización: {{organization_name}} ({{organization_slug}})
- Plan actual: {{current_plan_name}} (\`{{current_plan_code}}\`)
- Plan solicitado: {{requested_plan_name}} (\`{{requested_plan_code}}\`)
- Solicitado por: {{requested_by_email}}
- Mensaje: {{message}}
- Request id: {{request_id}}

— Equipo Factosys`,
    },
  ];

  for (const tpl of templates) {
    const existing = await db
      .select({ id: notificationTemplates.id })
      .from(notificationTemplates)
      .where(eq(notificationTemplates.code, tpl.code))
      .limit(1);
    if (existing[0]) {
      continue;
    }
    await db.insert(notificationTemplates).values({
      id: uuidv7(),
      code: tpl.code,
      channel: "email",
      subject: tpl.subject,
      bodyMd: tpl.bodyMd,
    });
  }
}

/** Idempotent Minimal Starter catalog (S14-PLAN / FE-409–410). */
async function seedSaasPlans(db: Pick<Db, "select" | "insert" | "update">): Promise<void> {
  const catalog: {
    code: string;
    name: string;
    description: string;
    priceMonthlyCents: number;
    priceDisplay: string;
    maxCompanies: number;
    maxUsers: number;
    maxDocumentsPerMonth: number;
    maxApiKeys: number;
  }[] = [
    {
      code: "starter",
      name: "Starter",
      description: "Para empezar a emitir con una empresa y límites básicos.",
      priceMonthlyCents: 4900,
      priceDisplay: "S/ 49",
      maxCompanies: 1,
      maxUsers: 2,
      maxDocumentsPerMonth: 100,
      maxApiKeys: 1,
    },
  ];

  for (const p of catalog) {
    const existing = await db
      .select({ id: plans.id })
      .from(plans)
      .where(eq(plans.code, p.code))
      .limit(1);
    if (existing[0]) {
      continue;
    }
    await db.insert(plans).values({
      id: uuidv7(),
      code: p.code,
      name: p.name,
      description: p.description,
      priceMonthlyCents: p.priceMonthlyCents,
      priceDisplay: p.priceDisplay,
      currency: "PEN",
      isActive: true,
      maxCompanies: p.maxCompanies,
      maxUsers: p.maxUsers,
      maxDocumentsPerMonth: p.maxDocumentsPerMonth,
      maxApiKeys: p.maxApiKeys,
    });
  }
}
