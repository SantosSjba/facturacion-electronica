import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { companies, documents, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";
import { XmlCryptoSignAdapter } from "@factosys/sunat-sign";
import {
  XmlTaxAgentBuilder,
  XmlVoidedDocumentsBuilder,
  toTaxAgentCanonical,
  type TaxAgentInput,
  type TaxAgentCanonical,
  type VoidedDocumentsCanonical,
} from "@factosys/sunat-ubl";
import { XmllintXsdValidationAdapter } from "@factosys/sunat-validation";
import {
  FakeBillServiceAdapter,
  SoapBillServiceAdapter,
  packInvoiceZip,
  packSummaryZip,
  parseCdrZip,
  type BillServicePort,
} from "@factosys/sunat-soap";
import type { Job } from "bullmq";
import { createHash } from "node:crypto";
import { CompaniesService } from "../companies/companies.service";
import { DB } from "../persistence/db.tokens";
import type { Env } from "../config/env.schema";
import { QueueProducer } from "../queues/queue.producer";
import type { QueueJobData } from "../queues/queue.tokens";
import { buildDocumentObjectKey } from "../storage/object-storage.keys";
import { DocumentsService } from "./documents.service";
import { EmitDocumentOrchestrator } from "./emit-document.orchestrator";
import { CredentialsResolver } from "./credentials-resolver";
import { supplierParty } from "./cpe-input";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
interface ReversionBody {
  company_id: string;
  document_type: "20" | "40";
  issue_date: string;
  reference_date: string;
  communicated_on: string;
  documents: { document_id: string; reason: string }[];
}
type FiscalPayload = Record<string, unknown> & {
  _canonical?: TaxAgentCanonical;
  _reversion?: { pending_id?: string; document_id?: string; status?: string };
  affected_document_ids?: string[];
  _agent?: { reconcile_count?: number; reconciliation_required?: boolean };
};
const accepted = (s: string) => ["accepted", "accepted_with_observation"].includes(s);
const validation = (m: string) => AppError.validation(m, [], { httpStatus: 422 });
const key = (r: TaxAgentCanonical["references"][number]) => `${r.document_type}/${r.serie_number}`;
const cents = (n: number) => BigInt(Math.round(n * 100));
const normalize = (s?: string | null) => s?.replace(/-0+(\d+)$/, "-$1");
const AGENT_WSDL = "https://e-factura.sunat.gob.pe/ol-ti-itemision-otroscpe-gem/billService?wsdl";

/** Independent 20/40 and RR. Company row lock serializes the payment ledger and reversions. */
@Injectable()
export class TaxAgentService {
  private readonly bill: BillServicePort;
  private readonly fake: boolean;
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly companiesService: CompaniesService,
    private readonly orchestrator: EmitDocumentOrchestrator,
    private readonly docs: DocumentsService,
    private readonly credentials: CredentialsResolver,
    private readonly queues: QueueProducer,
    config: ConfigService<Env, true>,
  ) {
    this.fake = config.get("SUNAT_AGENT_MODE", { infer: true }) !== "real";
    this.bill = this.fake
      ? new FakeBillServiceAdapter()
      : new SoapBillServiceAdapter({ wsdlUrl: AGENT_WSDL });
  }

  private assertEnvironment(environment: string) {
    if (this.fake && environment === "production")
      throw validation("Production tax-agent emission requires SUNAT_AGENT_MODE=real");
    if (!this.fake && environment !== "production")
      throw validation(
        "SUNAT other-CPE endpoint is production; use fake with a sandbox company for local tests",
      );
  }
  async assertCompanyScope(org: string, id: string) {
    await this.companiesService.requireCompany(org, id);
  }
  private today() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
  private checkWindow(issueDate: string, communicatedOn?: string) {
    const today = this.today();
    if (issueDate > today) throw validation("Fiscal issue date cannot be in the future");
    const start = communicatedOn ?? issueDate;
    if (start > issueDate || (Date.parse(today) - Date.parse(start)) / 86400000 > 7)
      throw validation(
        "SUNAT submission window is seven calendar days after emission or RR communication to the recipient",
      );
  }
  private async reversionHistory(
    db: Db | Tx,
    companyId: string,
    body: ReversionBody,
    environment: string,
  ) {
    const rows = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.companyId, companyId),
          eq(documents.documentType, "RR"),
          eq(documents.environment, environment),
        ),
      );
    return rows
      .filter((d) => {
        const p = d.payload as Partial<ReversionBody>;
        return p.reference_date === body.reference_date && p.document_type === body.document_type;
      })
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  private async lockCompany(tx: Tx, org: string, id: string, requireActive = true) {
    const [c] = await tx
      .select()
      .from(companies)
      .where(and(eq(companies.id, id), eq(companies.organizationId, org)))
      .for("update");
    if (!c || (requireActive && c.status !== "active"))
      throw AppError.notFound("Active company not found");
    return c;
  }
  private assertAgent(c: typeof companies.$inferSelect, type: "20" | "40", regime: string) {
    if (
      type === "20"
        ? !c.taxAgentSettings.retention
        : !c.taxAgentSettings.perception_regimes.includes(regime as "01" | "02" | "03")
    )
      throw validation(
        "Company is not enabled for this tax-agent regime; verify SUNAT designation before enabling",
      );
  }
  private canonical(
    type: "20" | "40",
    body: TaxAgentInput,
    supplier: TaxAgentCanonical["supplier"],
    number: number,
  ) {
    try {
      return toTaxAgentCanonical(type, body, supplier, number);
    } catch (e) {
      if (e instanceof AppError && e.httpStatus === 400) throw validation(e.message);
      throw e;
    }
  }
  async emit(
    org: string,
    type: "20" | "40",
    body: TaxAgentInput & { company_id: string },
    idempotencyKey: string,
  ) {
    const company = await this.companiesService.requireActiveCompany(org, body.company_id);
    this.assertEnvironment(company.environment);
    this.assertAgent(company, type, body.regime);
    this.checkWindow(body.issue_date);
    const { company_id: _id, ...fiscal } = body;
    void _id;
    // Reject inconsistent amounts/dates before allocating a correlative or reading credentials.
    this.canonical(type, fiscal, { ...supplierParty(company), identity_type: "6" }, 1);
    let canonical: TaxAgentCanonical;
    return this.orchestrator.execute({
      organizationId: org,
      companyId: company.id,
      documentType: type,
      serie: body.serie,
      issueDate: body.issue_date,
      currency: "PEN",
      customer: body.customer,
      payload: { ...body, _agent: { simulated: this.fake, reconciliation_required: false } },
      idempotencyKey,
      ublProfile: "2.0",
      sendQueue: "tax-agent",
      build: async ({ company: c, allocated, pfx, password }) => {
        canonical = this.canonical(
          type,
          fiscal,
          { ...supplierParty(c), identity_type: "6" },
          allocated.number,
        );
        const { signedXml } = await new XmlCryptoSignAdapter().sign({
          xml: new XmlTaxAgentBuilder().build(canonical).xml,
          certificate: pfx,
          password,
        });
        const rulesetVersion = await this.validate(type, signedXml);
        return {
          serie: body.serie,
          number: allocated.number,
          padded: allocated.padded,
          totals: canonical.totals,
          rulesetVersion,
          validationSnapshot: {
            canonical_rules: "tax-agent-v1",
            stages: ["xsd"],
            excel: false,
            ruleset_version: rulesetVersion,
          },
          canonicalSnapshot: canonical as unknown as Record<string, unknown>,
          signedXml,
          zipBytes: packInvoiceZip({
            ruc: c.ruc,
            documentType: type,
            serie: body.serie,
            number: allocated.number,
            xml: signedXml,
          }).zipBytes,
        };
      },
      beforePersist: async (tx, id) => {
        const locked = await this.lockCompany(tx, org, company.id);
        this.assertEnvironment(locked.environment);
        if (locked.environment !== company.environment)
          throw AppError.conflict("Company environment changed while signing");
        this.assertAgent(locked, type, body.regime);
        const history = await tx
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.companyId, company.id),
              eq(documents.documentType, type),
              eq(documents.environment, company.environment),
            ),
          );
        // Rejected CDR or accepted RR releases reservations; ambiguous/failed submissions retain them.
        const used = history
          .filter((d) => d.id !== id && !["rejected", "cancelled"].includes(d.status))
          .flatMap((d) => {
            const c = (d.payload as FiscalPayload)._canonical;
            return c?.customer.identity_number === canonical.customer.identity_number
              ? c.references
              : [];
          });
        for (const credit of canonical.references.filter((r) => r.adjusts_document)) {
          if (
            used.some(
              (r) =>
                r.document_type === "07" &&
                r.serie_number === credit.serie_number &&
                (r.adjusts_document?.document_type !== credit.adjusts_document?.document_type ||
                  r.adjusts_document?.serie_number !== credit.adjusts_document?.serie_number),
            )
          )
            throw AppError.conflict("Credit note already linked to a different related document");
        }
        for (const reference of canonical.references) {
          if (!reference.payment) continue;
          const prior = used.filter((r) => r.payment && key(r) === key(reference));
          if (prior.some((r) => r.payment?.number === reference.payment?.number))
            throw AppError.conflict("Payment already reserved by another tax-agent document");
          if (
            prior.some(
              (r) =>
                r.currency !== reference.currency ||
                r.total_amount !== reference.total_amount ||
                r.issue_date !== reference.issue_date,
            )
          )
            throw AppError.conflict("Related document metadata differs from prior payments");
          const current = canonical.references.filter(
            (r) => r.payment && key(r) === key(reference),
          );
          const credits = new Map<string, typeof reference>();
          for (const r of [...used, ...canonical.references].filter(
            (r) =>
              r.adjusts_document &&
              `${r.adjusts_document.document_type}/${r.adjusts_document.serie_number}` ===
                key(reference),
          )) {
            const existing = credits.get(r.serie_number);
            if (
              existing &&
              (existing.total_amount !== r.total_amount ||
                existing.issue_date !== r.issue_date ||
                existing.currency !== r.currency)
            )
              throw AppError.conflict("Credit note metadata differs from prior adjustments");
            credits.set(r.serie_number, r);
          }
          const creditTotal = [...credits.values()].reduce(
            (sum, r) => sum + cents(r.total_amount),
            0n,
          );
          if (
            [...prior, ...current].reduce((sum, r) => sum + cents(r.payment?.amount ?? 0), 0n) +
              creditTotal >
            cents(reference.total_amount)
          )
            throw AppError.conflict(
              "Accumulated payments exceed related document total after credit notes",
            );
        }
      },
    });
  }
  private async prepareReversion(org: string, body: ReversionBody) {
    const company = await this.companiesService.requireActiveCompany(org, body.company_id);
    this.assertEnvironment(company.environment);
    this.checkWindow(body.issue_date, body.communicated_on);
    if (body.reference_date > body.issue_date)
      throw validation("Reference date cannot exceed generation date");
    if (body.communicated_on < body.reference_date)
      throw validation("Communication date cannot precede affected document emission");
    if (new Set(body.documents.map((d) => d.document_id)).size !== body.documents.length)
      throw validation("Duplicate affected document");
    const originals = await Promise.all(
      body.documents.map((d) => this.docs.getById(org, d.document_id)),
    );
    const check = (d: typeof documents.$inferSelect) => {
      if (
        d.companyId !== company.id ||
        d.environment !== company.environment ||
        d.documentType !== body.document_type
      )
        throw validation(
          "RR only reverses this company's documents of the declared type in the same environment",
        );
      if (!d.serie || d.number == null || d.number < 1)
        throw validation("Affected document numbering missing");
      if (!accepted(d.status) || d.issueDate !== body.reference_date)
        throw validation("RR requires accepted documents issued on reference_date");
      if (
        (d.payload as FiscalPayload)._reversion?.pending_id ||
        (d.payload as FiscalPayload)._reversion?.status === "reversed"
      )
        throw AppError.conflict("Document already reversed or awaiting RR result");
    };
    originals.forEach(check);
    const history = await this.reversionHistory(this.db, company.id, body, company.environment);
    if (history.some((d) => !accepted(d.status) && d.status !== "rejected"))
      throw AppError.conflict(
        "Another RR for this date/type is unresolved; reconcile it before creating a replacement",
      );
    const previous = history.filter((d) => accepted(d.status)).at(-1);
    const previousLines =
      (previous?.payload as { _canonical?: VoidedDocumentsCanonical } | undefined)?._canonical
        ?.lines ?? [];
    if (previousLines.length + originals.length > 500)
      throw validation("Cumulative RR exceeds 500 lines");
    return { company, originals, previous, previousLines, check };
  }

  async previewReversion(org: string, body: ReversionBody): Promise<VoidedDocumentsCanonical> {
    const { company, originals, previousLines } = await this.prepareReversion(org, body);
    return {
      id: `RR-${body.issue_date.replace(/-/g, "")}-1`,
      issue_date: body.issue_date,
      reference_date: body.reference_date,
      supplier: supplierParty(company),
      lines: [
        ...previousLines,
        ...originals.map((d, i) => ({
          line_id: 0,
          document_type: d.documentType,
          serie: d.serie ?? "",
          number: d.number ?? 0,
          reason: body.documents[i]?.reason ?? "",
        })),
      ].map((line, i) => ({ ...line, line_id: i + 1 })),
    };
  }

  async revert(org: string, body: ReversionBody, idempotencyKey: string) {
    const { company, originals, previous, previousLines, check } = await this.prepareReversion(
      org,
      body,
    );
    const serie = body.issue_date.replace(/-/g, "");
    return this.orchestrator.execute({
      organizationId: org,
      companyId: company.id,
      documentType: "RR",
      serie,
      issueDate: body.issue_date,
      currency: "PEN",
      customer: { identity_type: "6", identity_number: company.ruc, name: company.legalName },
      payload: {
        ...body,
        _agent: { simulated: this.fake, reconciliation_required: false },
        affected_document_ids: originals.map((d) => d.id),
        replaces_reversion_id: previous?.id ?? null,
      },
      idempotencyKey,
      ublProfile: "2.0",
      sendQueue: "tax-agent",
      build: async ({ allocated, pfx, password }) => {
        const canonical: VoidedDocumentsCanonical = {
          id: `RR-${serie}-${allocated.number}`,
          issue_date: body.issue_date,
          reference_date: body.reference_date,
          supplier: supplierParty(company),
          lines: [
            ...previousLines,
            ...originals.map((d, i) => ({
              line_id: 0,
              document_type: d.documentType,
              serie: d.serie ?? "",
              number: d.number ?? 0,
              reason: body.documents[i]?.reason ?? "",
            })),
          ].map((line, i) => ({ ...line, line_id: i + 1 })),
        };
        const { signedXml } = await new XmlCryptoSignAdapter().sign({
          xml: new XmlVoidedDocumentsBuilder().build(canonical).xml,
          certificate: pfx,
          password,
        });
        const rulesetVersion = await this.validate("RR", signedXml);
        return {
          rulesetVersion,
          validationSnapshot: {
            canonical_rules: "tax-agent-v1",
            stages: ["xsd"],
            excel: false,
            ruleset_version: rulesetVersion,
          },
          documentIdentifier: canonical.id,
          serie,
          number: allocated.number,
          padded: allocated.padded,
          totals: {},
          canonicalSnapshot: canonical as unknown as Record<string, unknown>,
          signedXml,
          zipBytes: packSummaryZip({
            ruc: company.ruc,
            kind: "RR",
            referenceDateCompact: serie,
            correlative: allocated.number,
            xml: signedXml,
          }).zipBytes,
        };
      },
      beforePersist: async (tx, id) => {
        const locked = await this.lockCompany(tx, org, company.id);
        if (locked.environment !== company.environment)
          throw AppError.conflict("Company environment changed while signing");
        const latest = (
          await this.reversionHistory(tx, company.id, body, company.environment)
        ).filter((d) => d.id !== id);
        if (
          latest.some((d) => !accepted(d.status) && d.status !== "rejected") ||
          latest.filter((d) => accepted(d.status)).at(-1)?.id !== previous?.id
        )
          throw AppError.conflict("RR history changed; retry against latest accepted summary");
        for (const original of originals) {
          const [d] = await tx
            .select()
            .from(documents)
            .where(eq(documents.id, original.id))
            .for("update");
          if (!d) throw AppError.notFound("Affected document missing");
          check(d);
          await tx
            .update(documents)
            .set({
              payload: {
                ...(d.payload as FiscalPayload),
                _reversion: { status: "pending", pending_id: id },
              },
              updatedAt: new Date(),
            })
            .where(eq(documents.id, d.id));
        }
      },
    });
  }
  private async validate(type: "20" | "40" | "RR", xml: string) {
    const result = await new XmllintXsdValidationAdapter().validateXml({
      documentType: type,
      xml,
      stages: ["xsd"],
    });
    if (!result.ok)
      throw AppError.validation(
        "Tax-agent XML failed official UBL 2.0 XSD",
        result.issues.map((i) => ({ path: i.path ?? "xml", issue: i.message })),
        { httpStatus: 422 },
      );
    return result.rulesetVersion;
  }

  async reconcile(org: string, id: string) {
    const d = await this.docs.getById(org, id);
    if (d.documentType !== "RR" || !d.sunatTicket)
      throw validation(
        "Only RR with an existing ticket can be reconciled; identifier CDR recovery for 20/40 is not supported",
      );
    if (accepted(d.status) || d.status === "rejected") return this.docs.getDetails(org, id);
    if (d.status !== "ticket_pending") throw AppError.conflict("RR ticket is not pending");
    await this.db.transaction(async (tx) => {
      const [locked] = await tx.select().from(documents).where(eq(documents.id, id)).for("update");
      if (!locked) throw AppError.notFound("RR not found");
      const payload = locked.payload as FiscalPayload;
      const n = payload._agent?.reconcile_count ?? 0;
      if (n >= 3)
        throw AppError.conflict("RR reconciliation limit reached; consult SUNAT without resending");
      await tx
        .update(documents)
        .set({
          payload: {
            ...payload,
            _agent: { ...payload._agent, reconcile_count: n + 1, reconciliation_required: false },
          },
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id));
    });
    await this.queues.enqueue(
      "tax-agent",
      { organizationId: org, companyId: d.companyId, documentId: id },
      { attempts: 8, backoff: { type: "exponential", delay: 3000 } },
    );
    return this.docs.getDetails(org, id);
  }
  /** Repairs missing queue jobs after a restart without resending uncertain submissions. */
  async sweep() {
    const rows = await this.db
      .select()
      .from(documents)
      .where(
        and(
          inArray(documents.documentType, ["20", "40", "RR"]),
          inArray(documents.status, ["queued", "ticket_pending", "sent"]),
          eq(documents.environment, this.fake ? "sandbox" : "production"),
          lt(documents.updatedAt, new Date(Date.now() - 120000)),
          sql`coalesce(${documents.payload}->'_agent'->>'reconciliation_required','false') = 'false'`,
        ),
      )
      .limit(100);
    for (const d of rows) {
      if (d.status === "sent") {
        const input: Parameters<DocumentsService["appendEvent"]>[0] = {
          organizationId: d.organizationId,
          companyId: d.companyId,
          documentId: d.id,
          status: "sent",
          detail: "Submission interrupted; review with SUNAT without resending",
          source: "system",
        };
        const eventId = await this.db.transaction(async (tx) => {
          const [current] = await tx
            .select()
            .from(documents)
            .where(eq(documents.id, d.id))
            .for("update");
          if (
            !current ||
            current.status !== "sent" ||
            (current.payload as FiscalPayload)._agent?.reconciliation_required
          )
            return undefined;
          await tx
            .update(documents)
            .set({
              payload: {
                ...(current.payload as FiscalPayload),
                _agent: {
                  ...(current.payload as FiscalPayload)._agent,
                  simulated: this.fake,
                  reconciliation_required: true,
                  reason: "submission_uncertain_after_restart_do_not_resend",
                },
              },
              updatedAt: new Date(),
            })
            .where(eq(documents.id, d.id));
          return this.docs.appendEvent(input, tx);
        });
        if (eventId) this.docs.publishEvent(input, eventId);
      } else {
        if (d.status === "ticket_pending" && !d.sunatTicket) continue;
        await this.queues.enqueue(
          "tax-agent",
          { organizationId: d.organizationId, companyId: d.companyId, documentId: d.id },
          {
            jobId: `tax-agent-sweep-${d.id}-${Math.floor(Date.now() / 120000)}`,
            attempts: 8,
            backoff: { type: "exponential", delay: 3000 },
          },
        );
      }
    }
  }
  async process(job: Job<QueueJobData>) {
    const { organizationId: org, companyId, documentId: id } = job.data;
    if (!companyId || !id) throw new Error("Tax-agent job requires company and document IDs");
    let d = await this.docs.getById(org, id);
    if (d.companyId !== companyId || !["20", "40", "RR"].includes(d.documentType))
      throw new Error("Invalid tax-agent job scope");
    if (!["queued", "ticket_pending"].includes(d.status)) return { ok: true, status: d.status };
    this.assertEnvironment(d.environment);
    if (!d.issueDate) throw new Error("Missing tax-agent emission date");
    if (d.status === "queued") {
      try {
        this.checkWindow(
          d.issueDate,
          d.documentType === "RR" ? (d.payload as ReversionBody).communicated_on : undefined,
        );
      } catch (cause) {
        const claimed = await this.db
          .update(documents)
          .set({
            status: "failed",
            updatedAt: new Date(),
            error: {
              message: cause instanceof Error ? cause.message : "Submission window expired",
            },
            payload: {
              ...(d.payload as FiscalPayload),
              _agent: {
                ...(d.payload as FiscalPayload)._agent,
                reconciliation_required: true,
                reason: "expired_before_submission",
              },
            },
          })
          .where(and(eq(documents.id, id), eq(documents.status, "queued")))
          .returning({ id: documents.id });
        if (claimed.length)
          await this.docs.appendEvent({
            organizationId: org,
            companyId,
            documentId: id,
            status: "failed",
            fromStatus: "queued",
            detail: "Submission window expired before wire; review the reserved document",
            source: "worker",
          });
        return { ok: true, status: "failed" };
      }
    }
    const sol = await this.credentials.resolveSol(companyId);
    const canonical = (d.payload as FiscalPayload)._canonical;
    const ruc = canonical?.supplier.identity_number;
    if (!ruc) throw new Error("Missing signed document canonical issuer");
    try {
      let rawCdrZip: Buffer;
      if (d.status === "queued") {
        // CAS claim prevents duplicate external submissions; never resend a sent/uncertain document.
        const claimed = await this.db
          .update(documents)
          .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
          .where(and(eq(documents.id, id), eq(documents.status, "queued")))
          .returning({ id: documents.id });
        if (!claimed.length) return { ok: true, status: "sent" };
        await this.docs.appendEvent({
          organizationId: org,
          companyId,
          documentId: id,
          status: "sent",
          fromStatus: "queued",
          detail:
            d.documentType === "RR" ? "RR sendSummary submitted" : "Tax-agent sendBill submitted",
          source: "worker",
        });
        const zip = await this.docs.getArtifact(org, id, "zip");
        const fileName =
          d.documentType === "RR"
            ? `${ruc}-RR-${d.serie}-${d.number}.zip`
            : `${ruc}-${d.documentType}-${d.serie}-${d.number}.zip`;
        const request = {
          zipBytes: zip.body,
          fileName,
          solUser: sol.username,
          solPassword: sol.password,
        };
        if (d.documentType === "RR") {
          const { ticket } = await this.bill.sendSummary(request);
          await this.docs.transitionStatus(id, "sent", "ticket_pending", { sunatTicket: ticket });
          await this.docs.patchPayload(id, {
            _agent: { simulated: this.fake, reconciliation_required: false },
          });
          await this.docs.appendEvent({
            organizationId: org,
            companyId,
            documentId: id,
            status: "ticket_pending",
            fromStatus: "sent",
            detail: "RR ticket assigned",
            source: "sunat",
          });
          await this.queues.enqueue("tax-agent", job.data, {
            attempts: 8,
            backoff: { type: "exponential", delay: 3000 },
            delay: 3000,
          });
          return { ok: true, status: "ticket_pending" };
        }
        rawCdrZip = (await this.bill.sendBill(request)).rawCdrZip;
        d = await this.docs.getById(org, id);
      } else {
        if (!d.sunatTicket) throw new Error("RR missing ticket; do not resend");
        rawCdrZip = (
          await this.bill.getStatus({
            ticket: d.sunatTicket,
            solUser: sol.username,
            solPassword: sol.password,
          })
        ).rawCdrZip;
      }
      const cdr = parseCdrZip(rawCdrZip);
      const expected = d.documentType === "RR" ? `RR-${d.serie}-${d.number}` : d.serieNumber;
      if (
        !this.fake &&
        (normalize(cdr.documentId) !== normalize(expected) || cdr.receiverRuc !== ruc)
      )
        throw new Error("CDR identity differs from submitted tax-agent document");
      await this.docs.putArtifact({
        organizationId: org,
        companyId,
        documentId: id,
        kind: "cdr_xml",
        body: rawCdrZip,
        contentType: "application/zip",
        objectKey: buildDocumentObjectKey({
          organizationId: org,
          companyId,
          documentId: id,
          kind: "cdr_xml",
          sha256: createHash("sha256").update(rawCdrZip).digest("hex"),
          ext: "zip",
        }),
      });
      const pendingEvents: { input: Parameters<DocumentsService["appendEvent"]>[0]; id: string }[] =
        [];
      // Commit fiscal outcome and all RR effects together, including release of the payment reservations.
      const finalized = await this.db.transaction(async (tx) => {
        await this.lockCompany(tx, org, companyId, false);
        const [locked] = await tx
          .select()
          .from(documents)
          .where(eq(documents.id, id))
          .for("update");
        if (!locked || !["sent", "ticket_pending"].includes(locked.status)) return false;
        const payload = locked.payload as FiscalPayload;
        if (locked.documentType === "RR") {
          for (const originId of payload.affected_document_ids ?? []) {
            const [origin] = await tx
              .select()
              .from(documents)
              .where(
                and(
                  eq(documents.id, originId),
                  eq(documents.companyId, companyId),
                  eq(documents.organizationId, org),
                  inArray(documents.documentType, ["20", "40"]),
                ),
              )
              .for("update");
            if (!origin || (origin.payload as FiscalPayload)._reversion?.pending_id !== id)
              throw new Error("RR affected-document reservation missing");
            const reversed = accepted(cdr.status);
            await tx
              .update(documents)
              .set({
                status: reversed ? "cancelled" : origin.status,
                payload: {
                  ...(origin.payload as FiscalPayload),
                  _reversion: { status: reversed ? "reversed" : "rejected", document_id: id },
                },
                updatedAt: new Date(),
              })
              .where(eq(documents.id, originId));
            if (reversed) {
              const input: Parameters<DocumentsService["appendEvent"]>[0] = {
                organizationId: org,
                companyId,
                documentId: origin.id,
                status: "cancelled",
                fromStatus: origin.status,
                detail: `Reversed by RR ${expected}`,
                source: "sunat",
                data: { reversion_document_id: id },
              };
              pendingEvents.push({ input, id: await this.docs.appendEvent(input, tx) });
            }
          }
        }
        await tx
          .update(documents)
          .set({
            status: cdr.status,
            sunatResponseCode: cdr.sunatCode,
            sunatResponseMessage: cdr.sunatMessage ?? null,
            completedAt: new Date(),
            updatedAt: new Date(),
            payload: {
              ...payload,
              _sunat: { observations: cdr.observations },
              _agent: { ...payload._agent, simulated: this.fake, reconciliation_required: false },
            },
          })
          .where(eq(documents.id, id));
        const input: Parameters<DocumentsService["appendEvent"]>[0] = {
          organizationId: org,
          companyId,
          documentId: id,
          status: cdr.status,
          fromStatus: locked.status,
          detail: cdr.sunatMessage ?? `CDR ${cdr.sunatCode}`,
          source: "sunat",
          data: { simulated: this.fake, sunat_code: cdr.sunatCode },
        };
        pendingEvents.push({ input, id: await this.docs.appendEvent(input, tx) });
        return true;
      });
      if (finalized)
        for (const event of pendingEvents) this.docs.publishEvent(event.input, event.id);
      return { ok: true, status: cdr.status };
    } catch (cause) {
      const current = await this.docs.getById(org, id);
      if (current.status === "sent") {
        await this.docs.transitionStatus(id, "sent", "failed", {
          error: { message: cause instanceof Error ? cause.message : "Tax-agent transport failed" },
        });
        await this.docs.patchPayload(id, {
          _agent: {
            simulated: this.fake,
            reconciliation_required: true,
            reason: "submission_uncertain_do_not_resend",
          },
        });
        await this.docs.appendEvent({
          organizationId: org,
          companyId,
          documentId: id,
          status: "failed",
          fromStatus: "sent",
          detail: "Submission uncertain; do not resend or reuse payments",
          source: "worker",
        });
      } else if (
        current.status === "ticket_pending" &&
        job.attemptsMade + 1 >= Math.min(job.opts.attempts ?? 8, 8)
      ) {
        await this.docs.patchPayload(id, {
          _agent: {
            ...(current.payload as FiscalPayload)._agent,
            simulated: this.fake,
            reconciliation_required: true,
            reason: "poll_exhausted",
          },
        });
        await this.docs.appendEvent({
          organizationId: org,
          companyId,
          documentId: id,
          status: "ticket_pending",
          detail: "RR poll exhausted; reconcile existing ticket",
          source: "worker",
        });
        return { ok: true, status: "ticket_pending" };
      }
      throw cause;
    }
  }
}
