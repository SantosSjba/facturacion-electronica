import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/shared/ui/ErrorState";
import { FieldError } from "@/shared/ui/FieldError";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";

import { emitCreditNote, emitDebitNote, fetchCompanies } from "../api";
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
  NoteCreateInput,
} from "../types";
import {
  noteAffectedSchema,
  wizardCommonStepError,
  zodFieldErrors,
} from "../validation";

const STEPS = ["Cabecera", "Cliente", "Líneas", "Afectado", "Revisión"];
const SERIE_PREFIX = /^[FfBb]/;

function NoteWizardPage({ kind }: { kind: "credit" | "debit" }) {
  const navigate = useNavigate();
  const isCredit = kind === "credit";
  const documentType = isCredit ? "07" : "08";
  const [step, setStep] = useState(0);
  const [idem] = useState(() => newIdempotencyKey());
  const [header, setHeader] = useState<CommonHeaderState>(() => emptyHeader(idem));
  const [customer, setCustomer] = useState<CustomerInput>(emptyCustomer);
  const [lines, setLines] = useState<InvoiceLineInput[]>([emptyLine()]);
  const [noteType, setNoteType] = useState(isCredit ? "01" : "01");
  const [reason, setReason] = useState("");
  const [affectedType, setAffectedType] = useState<"01" | "03" | "12">("01");
  const [affectedSerie, setAffectedSerie] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });

  const payload: NoteCreateInput = useMemo(
    () => ({
      company_id: header.company_id,
      serie: header.serie,
      ...(header.number ? { number: Number(header.number) } : {}),
      issue_date: header.issue_date,
      currency: header.currency,
      note_type: noteType,
      reason,
      affected_document: {
        document_type: affectedType,
        serie_number: affectedSerie.trim().toUpperCase(),
      },
      customer: {
        identity_type: customer.identity_type,
        identity_number: customer.identity_number,
        name: customer.name,
        ...(customer.email ? { email: customer.email } : {}),
      },
      lines,
      totals_mode: header.totals_mode,
    }),
    [
      header,
      customer,
      lines,
      noteType,
      reason,
      affectedType,
      affectedSerie,
    ],
  );

  const affectedErrors = zodFieldErrors<"reason" | "affected_serie_number">(
    noteAffectedSchema.safeParse({
      reason,
      affected_serie_number: affectedSerie,
    }),
  );

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const doc = isCredit
        ? await emitCreditNote(payload, header.idempotency_key)
        : await emitDebitNote(payload, header.idempotency_key);
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
      title={
        isCredit
          ? "Emitir nota de crédito (07)"
          : "Emitir nota de débito (08)"
      }
      description="Requiere documento afectado aceptado."
      step={step}
      steps={STEPS}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
      onSubmit={() => void onSubmit()}
      submitting={submitting}
      nextError={wizardCommonStepError(step, {
        header,
        customer,
        lines,
        seriePrefix: SERIE_PREFIX,
        serieHint: "La serie debe empezar con F o B (ej. FC01)",
        affectedStep: 3,
        affected: {
          reason,
          affected_serie_number: affectedSerie,
        },
      })}
    >
      {step === 0 ? (
        <HeaderStep
          value={header}
          onChange={setHeader}
          companies={companiesQuery.data ?? []}
          documentType={documentType}
          seriePrefix={/^[FfBb]/}
          showOperationType={false}
        />
      ) : null}
      {step === 1 ? (
        <CustomerStep value={customer} onChange={setCustomer} />
      ) : null}
      {step === 2 ? <LinesStep lines={lines} onChange={setLines} /> : null}
      {step === 3 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Tipo de nota (cat. 09/10)</Label>
            <Input
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
              maxLength={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Doc. afectado — tipo</Label>
            <Select
              value={affectedType}
              onChange={(e) =>
                setAffectedType(e.target.value as "01" | "03" | "12")
              }
            >
              <option value="01">01 Factura</option>
              <option value="03">03 Boleta</option>
              <option value="12">12 Ticket</option>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Serie-Número afectado</Label>
            <Input
              placeholder="F001-1"
              value={affectedSerie}
              aria-invalid={Boolean(
                affectedSerie && affectedErrors.affected_serie_number,
              )}
              onChange={(e) => setAffectedSerie(e.target.value)}
            />
            <FieldError
              message={
                affectedSerie
                  ? affectedErrors.affected_serie_number
                  : undefined
              }
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Motivo</Label>
            <Input
              value={reason}
              aria-invalid={Boolean(reason.length > 0 && affectedErrors.reason)}
              onChange={(e) => setReason(e.target.value)}
            />
            <FieldError
              message={reason.length > 0 ? affectedErrors.reason : undefined}
            />
          </div>
        </div>
      ) : null}
      {step === 4 ? <ReviewStep payload={payload} error={error} /> : null}
    </WizardShell>
  );
}

export function CreditNoteWizardPage() {
  return <NoteWizardPage kind="credit" />;
}

export function DebitNoteWizardPage() {
  return <NoteWizardPage kind="debit" />;
}
