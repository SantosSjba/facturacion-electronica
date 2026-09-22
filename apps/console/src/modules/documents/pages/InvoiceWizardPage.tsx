import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/shared/ui/ErrorState";

import { emitInvoice, fetchCompanies } from "../api";
import { WizardShell } from "../components/wizard/WizardShell";
import {
  CustomerStep,
  emptyCustomer,
  emptyHeader,
  emptyLine,
  HeaderStep,
  LinesStep,
  ReviewStep,
  type CommonHeaderState,
} from "../components/wizard/steps";
import { newIdempotencyKey, pollDocumentStatus } from "../poll";
import type { CustomerInput, InvoiceCreateInput, InvoiceLineInput } from "../types";

const STEPS = ["Cabecera", "Cliente", "Líneas", "Extras", "Revisión"];

export function InvoiceWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [idem] = useState(() => newIdempotencyKey());
  const [header, setHeader] = useState<CommonHeaderState>(() => emptyHeader(idem));
  const [customer, setCustomer] = useState<CustomerInput>(emptyCustomer);
  const [lines, setLines] = useState<InvoiceLineInput[]>([emptyLine()]);
  const [purchaseOrder, setPurchaseOrder] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });

  const payload: InvoiceCreateInput = useMemo(() => {
    const body: InvoiceCreateInput = {
      company_id: header.company_id,
      serie: header.serie,
      operation_type: header.operation_type,
      issue_date: header.issue_date,
      currency: header.currency,
      totals_mode: header.totals_mode,
      customer: {
        identity_type: customer.identity_type,
        identity_number: customer.identity_number,
        name: customer.name,
        ...(customer.email ? { email: customer.email } : {}),
      },
      lines: lines.map((l) => ({
        ...l,
        unit_price: l.unit_price,
      })),
    };
    if (header.number) body.number = Number(header.number);
    if (header.issue_time) body.issue_time = header.issue_time;
    if (header.due_date) body.due_date = header.due_date;
    if (purchaseOrder || header.purchase_order) {
      body.purchase_order = purchaseOrder || header.purchase_order;
    }
    return body;
  }, [header, customer, lines, purchaseOrder]);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const doc = await emitInvoice(payload, header.idempotency_key);
      const final = await pollDocumentStatus(doc.id);
      navigate(`/documents/${final.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al emitir");
      setStep(4);
    } finally {
      setSubmitting(false);
    }
  }

  if (companiesQuery.error) {
    return (
      <ErrorState
        message={
          companiesQuery.error instanceof Error
            ? companiesQuery.error.message
            : "Error"
        }
        onRetry={() => void companiesQuery.refetch()}
      />
    );
  }

  return (
    <WizardShell
      title="Emitir factura (01)"
      description="Wizard con Idempotency-Key y poll de estado SUNAT."
      step={step}
      steps={STEPS}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
      onSubmit={() => void onSubmit()}
      submitting={submitting}
      nextDisabled={
        (step === 0 && (!header.company_id || !header.serie)) ||
        (step === 1 &&
          (!customer.identity_number || !customer.name)) ||
        (step === 2 && lines.some((l) => !l.description))
      }
    >
      {step === 0 ? (
        <HeaderStep
          value={header}
          onChange={setHeader}
          companies={companiesQuery.data ?? []}
          documentType="01"
          seriePrefix={/^[Ff]/}
        />
      ) : null}
      {step === 1 ? (
        <CustomerStep value={customer} onChange={setCustomer} />
      ) : null}
      {step === 2 ? <LinesStep lines={lines} onChange={setLines} /> : null}
      {step === 3 ? (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Orden de compra (opc.)</label>
          <input
            className="flex h-10 w-full rounded-md border border-[var(--input)] bg-[var(--card)] px-3 text-sm"
            value={purchaseOrder}
            onChange={(e) => setPurchaseOrder(e.target.value)}
          />
          <p className="text-xs text-[var(--muted-foreground)]">
            Detraction / payment_means se pueden ampliar luego; la API acepta
            objetos opcionales.
          </p>
        </div>
      ) : null}
      {step === 4 ? <ReviewStep payload={payload} error={error} /> : null}
    </WizardShell>
  );
}
