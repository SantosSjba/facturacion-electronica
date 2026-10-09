import { and, eq, inArray } from "drizzle-orm";
import { companies, documents, webhookEndpoints, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";
import type { Request } from "express";
import type { ApiKeyAuthContext } from "../auth/auth-context";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Runs before pipes/controllers: resolve opaque resource IDs as well as explicit emitters. */
export async function enforceApiKeyCompanies(
  db: Db | undefined,
  req: Request,
  auth: ApiKeyAuthContext,
) {
  if (!db || !auth.companyIds?.length)
    throw AppError.forbidden("Assign authorized companies to this API key before using it");
  const rows = await db
    .select({ id: companies.id, environment: companies.environment })
    .from(companies)
    .where(
      and(
        eq(companies.organizationId, auth.organizationId),
        inArray(companies.id, auth.companyIds),
      ),
    );
  auth.companyIds = rows
    .filter((row) => !auth.environmentConstraint || row.environment === auth.environmentConstraint)
    .map((row) => row.id);
  if (!auth.companyIds.length) throw AppError.forbidden("No authorized companies available");
  const allowed = new Set(auth.companyIds);
  const assertCompany = (id: unknown) => {
    if (typeof id !== "string" || !allowed.has(id))
      throw AppError.forbidden("API key does not authorize this company");
  };
  const path = (req.originalUrl.split("?")[0] ?? "").replace(/\/+$/, "");
  const body = req.body as
    { company_id?: unknown; document?: { company_id?: unknown } } | undefined;
  const explicit = [
    req.params["companyId"],
    req.query["company_id"],
    body?.company_id,
    body?.document?.company_id,
  ].filter((id) => id !== undefined);
  if (typeof req.body === "string") {
    const records = req.body
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter((line) => line.startsWith("FIELD|company_id|"));
    if (records.length !== 1) throw AppError.validation("TXT requires one company_id");
    try {
      explicit.push(JSON.parse((records[0] ?? "").slice("FIELD|company_id|".length)));
    } catch {
      throw AppError.validation("Invalid TXT company_id");
    }
  }
  for (const id of explicit) assertCompany(id);
  if (req.params["companyId"]) return;
  if (/^\/v1\/companies\//.test(path)) {
    assertCompany(req.params["id"]);
    return;
  }
  const assertDocument = async (id: unknown) => {
    if (typeof id !== "string" || !UUID.test(id)) throw AppError.validation("Invalid document ID");
    const [doc] = await db
      .select({ companyId: documents.companyId })
      .from(documents)
      .where(and(eq(documents.organizationId, auth.organizationId), eq(documents.id, id)));
    if (!doc) throw AppError.notFound("Document not found");
    assertCompany(doc.companyId);
  };
  if (/^\/v1\/(documents|despatch-advices|reversions)\//.test(path)) {
    await assertDocument(req.params["id"]);
    return;
  }
  if (path === "/v1/documents" && req.query["cursor"]) await assertDocument(req.query["cursor"]);
  if (/^\/v1\/webhook-endpoints\//.test(path)) {
    const id = req.params["id"];
    if (typeof id !== "string" || !UUID.test(id)) throw AppError.validation("Invalid webhook ID");
    const [endpoint] = await db
      .select({ companyId: webhookEndpoints.companyId })
      .from(webhookEndpoints)
      .where(
        and(eq(webhookEndpoints.organizationId, auth.organizationId), eq(webhookEndpoints.id, id)),
      );
    if (!endpoint) throw AppError.notFound("Webhook endpoint not found");
    assertCompany(endpoint.companyId);
    return;
  }
  if (
    req.method === "GET" &&
    ["/v1/companies", "/v1/documents", "/v1/webhook-endpoints"].includes(path)
  )
    return;
  if (/^\/v1\/(whoami|company-tools)(\/|$)/.test(path)) return;
  if (
    /^\/v1\/(invoices|receipts|credit-notes|debit-notes|despatch-advices|daily-summaries|voided-documents|retentions|perceptions|reversions|previews|sale\/qr|validations\/cpe|document-status|webhook-endpoints)(\/|$)/.test(
      path,
    ) &&
    explicit.length
  )
    return;
  throw AppError.forbidden("This operation requires company-scoped authorization");
}
