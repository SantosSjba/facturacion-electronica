import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/shared/ui/ErrorState";
import { Input } from "@/shared/ui/components/input";
import { MutedText } from "@/shared/ui/components/muted-text";

import { emitReceipt, fetchCompanies } from "../api";
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
import type {
  CustomerInput,
  InvoiceLineInput,
  ReceiptCreateInput,
} from "../types";

const STEPS = ["Cabecera", "Cliente", "Líneas", "Extras", "Revisión"];

export function ReceiptWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [idem] = useState(() => newIdempotencyKey());
  const [header, setHeader] = useState<CommonHeaderState>(() => {
    const h = emptyHeader(idem);
    h.operation_type = "0101";
    return h;
  });
  const [customer, setCustomer] = useState<CustomerInput>(() => {
    const c = emptyCustomer();
    c.identity_type = "1";
    return c;
  });
  const [lines, setLines] = useState<InvoiceLineInput[]>([emptyLine()]);
  const [includeInSummary, setIncludeInSummary] = useState(true);
  const [sendIndividually, setSendIndividually] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });

  const payload: ReceiptCreateInput = useMemo(() => {
    const body: ReceiptCreateInput = {
      company_id: header.company_id,
      serie: header.serie,
      operation_type: header.operation_type,
      issue_date: header.issue_date,
      currency: header.currency,
      totals_mode: header.totals_mode,
      include_in_daily_summary: includeInSummary,
      send_individually: sendIndividually,
      customer: {
        identity_type: customer.identity_type,
        identity_number: customer.identity_number,
        name: customer.name,
        ...(customer.email ? { email: customer.email } : {}),
      },
      lines,
    };
    if (header.number) body.number = Number(header.number);
    if (header.issue_time) body.issue_time = header.issue_time;
    return body;
  }, [header, customer, lines, includeInSummary, sendIndividually]);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const doc = await emitReceipt(payload, header.idempotency_key);
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
      title="Emitir boleta (03)"
      description="Serie B* · resumen diario / envío individual."
      step={step}
      steps={STEPS}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
      onSubmit={() => void onSubmit()}
      submitting={submitting}
      nextError={
        step === 0 && (!header.company_id || !header.serie)
          ? "Selecciona la empresa y una serie activa para continuar."
          : step === 1 && (!customer.identity_number || !customer.name)
            ? "Completa el documento de identidad y el nombre del cliente."
            : step === 2 && lines.some((line) => !line.description || line.quantity <= 0 || line.unit_value < 0)
              ? "Cada línea debe tener descripción, cantidad mayor a cero y un valor unitario válido."
              : null
      }
    >
      {step === 0 ? (
        <HeaderStep
          value={header}
          onChange={setHeader}
          companies={companiesQuery.data ?? []}
          documentType="03"
          seriePrefix={/^[Bb]/}
        />
      ) : null}
      {step === 1 ? (
        <CustomerStep
          value={customer}
          onChange={setCustomer}
          identityHint="Boleta: suele usarse DNI (1) u otros tipos no RUC."
        />
      ) : null}
      {step === 2 ? <LinesStep lines={lines} onChange={setLines} /> : null}
      {step === 3 ? (
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <Input
              type="checkbox"
              className="h-4 w-4"
              checked={includeInSummary}
              onChange={(e) => setIncludeInSummary(e.target.checked)}
            />
            Incluir en resumen diario (RC)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Input
              type="checkbox"
              className="h-4 w-4"
              checked={sendIndividually}
              onChange={(e) => setSendIndividually(e.target.checked)}
            />
            Enviar individualmente
          </label>
          <MutedText className="text-xs">
            Si envías individualmente, no se requiere RC.
          </MutedText>
        </div>
      ) : null}
      {step === 4 ? <ReviewStep payload={payload} error={error} /> : null}
    </WizardShell>
  );
}
