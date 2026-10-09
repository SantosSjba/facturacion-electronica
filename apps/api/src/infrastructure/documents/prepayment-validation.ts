import { documents, type Db } from "@factosys/db";
import { and, eq, sql } from "drizzle-orm";
import { AppError } from "@factosys/shared";
import type { InvoiceCanonical } from "@factosys/sunat-ubl";
interface Input {
  organizationId: string;
  companyId: string;
  companyRuc: string;
  currency: string;
  customer: { identity_type: string; identity_number: string };
  prepayments: NonNullable<InvoiceCanonical["prepayments"]>;
}
type Database = Pick<Db, "select" | "execute">;
const normalized = (value: string) => value.replace(/-0*(\d+)$/, "-$1");
/** Rechecked under the organization's emission lock, before inserting the consuming document. */
export async function validatePrepayments(db: Database, input: Input, lock = false): Promise<void> {
  const reject = (index: number, issue: string): never => {
    throw AppError.validation(
      "Invalid prepayment reference",
      [{ path: `prepayments.${index}`, issue }],
      { httpStatus: 422 },
    );
  };
  const references = new Set<string>();
  for (const [i, p] of input.prepayments.entries()) {
    const key = `${p.document_type}:${normalized(p.serie_number.toUpperCase())}`;
    if (references.has(key)) reject(i, "Duplicate normalized prepayment reference");
    references.add(key);
  }
  for (const [i, p] of [...input.prepayments]
    .sort((a, b) => a.serie_number.localeCompare(b.serie_number))
    .entries()) {
    if (p.issuer_ruc !== input.companyRuc)
      reject(i, "Prepayment issuer must be the issuing company");
    const [serie, number] = p.serie_number.split("-");
    const query = db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.organizationId, input.organizationId),
          eq(documents.companyId, input.companyId),
          eq(documents.documentType, p.document_type),
          eq(documents.serie, serie ?? ""),
          eq(documents.number, Number(number)),
        ),
      );
    const rows = lock ? await query.for("update") : await query;
    const source = rows[0] ?? reject(i, "Referenced prepayment document does not exist");
    if (!["accepted", "accepted_with_observation"].includes(source.status))
      reject(i, "Referenced prepayment must be accepted");
    if (
      source.currency !== input.currency ||
      source.customerIdentityType !== input.customer.identity_type ||
      source.customerIdentityNumber !== input.customer.identity_number
    )
      reject(i, "Prepayment currency and customer must match");
    if (p.paid_date < (source.issueDate ?? ""))
      reject(i, "Payment cannot precede the source issue date");
    const totals = source.totals as InvoiceCanonical["totals"];
    const scheme = { "10": "1000", "17": "1016", "20": "9997", "30": "9998" }[p.tax_affectation];
    const percent =
      p.percent ?? (p.tax_affectation === "10" ? 18 : p.tax_affectation === "17" ? 4 : 0);
    const group = totals.tax_subtotals?.find(
      (g) => g.tax_scheme_id === scheme && g.percent === percent,
    );
    if (!group) reject(i, "Prepayment fiscal category/rate must exist in the source document");
    if (group && Math.round(p.base_amount * 100) > Math.round(group.taxable_amount * 100))
      reject(i, "Prepayment base exceeds the source fiscal category");
    if (p.isc_amount) {
      const isc = totals.tax_subtotals?.find(
        (g) =>
          g.tax_scheme_id === "2000" &&
          g.percent === p.isc_percent &&
          g.tier_range === p.isc_system,
      );
      if (!isc || Math.round(p.isc_amount * 100) > Math.round(isc.tax_amount * 100))
        reject(i, "ISC advance must match the source system/rate and available tax");
    }
    const consumed = await db.execute(sql`
      select coalesce(sum((p.value->>'amount')::numeric),0)::text as amount,
        coalesce(sum((p.value->>'base_amount')::numeric) filter(where p.value->>'tax_affectation'=${p.tax_affectation}
          and coalesce((p.value->>'percent')::numeric,case p.value->>'tax_affectation' when '10' then 18 when '17' then 4 else 0 end)=${percent}),0)::text as base_amount,
        coalesce(sum((p.value->>'isc_amount')::numeric) filter(where p.value->>'isc_system'=${p.isc_system ?? ""}
          and (p.value->>'isc_percent')::numeric=${p.isc_percent ?? 0}),0)::text as isc_amount
      from documents d cross join lateral jsonb_array_elements(coalesce(d.payload->'prepayments','[]'::jsonb)) p
      where d.organization_id=${input.organizationId} and d.company_id=${input.companyId}
        and d.status not in ('rejected','cancelled')
        and p.value->>'issuer_ruc'=${input.companyRuc} and p.value->>'document_type'=${p.document_type}
        and (split_part(p.value->>'serie_number','-',1) || '-' || (split_part(p.value->>'serie_number','-',2)::bigint)::text)=${normalized(p.serie_number)}
    `);
    const used = Number((consumed[0] as { amount?: string } | undefined)?.amount ?? 0);
    const consumedFiscal = consumed[0] as { base_amount?: string; isc_amount?: string } | undefined;
    if (
      group &&
      Math.round((Number(consumedFiscal?.base_amount ?? 0) + p.base_amount) * 100) >
        Math.round(group.taxable_amount * 100)
    )
      reject(i, "Prepayment fiscal base has already been applied");
    const iscGroup = totals.tax_subtotals?.find(
      (g) =>
        g.tax_scheme_id === "2000" && g.percent === p.isc_percent && g.tier_range === p.isc_system,
    );
    if (
      p.isc_amount &&
      iscGroup &&
      Math.round((Number(consumedFiscal?.isc_amount ?? 0) + p.isc_amount) * 100) >
        Math.round(iscGroup.tax_amount * 100)
    )
      reject(i, "Prepayment ISC has already been applied");
    if (Math.round((used + p.amount) * 100) > Math.round(totals.payable_amount * 100))
      reject(i, "Prepayment is already applied or exceeds the remaining amount");
  }
}
