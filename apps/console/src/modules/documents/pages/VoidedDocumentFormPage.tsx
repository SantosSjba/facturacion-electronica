import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Send } from "lucide-react";

import { ErrorState } from "@/shared/ui/ErrorState";
import { FieldError } from "@/shared/ui/FieldError";
import { PageHeader } from "@/shared/ui/PageHeader";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
  buttonVariants,
} from "@/shared/ui/components/button";
import { Card, CardTitle } from "@/shared/ui/components/card";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { MutedText } from "@/shared/ui/components/muted-text";
import { Select } from "@/shared/ui/components/select";
import { cn } from "@/shared/ui/utils";

import { emitVoidedDocument, fetchCompanies } from "../api";
import { newIdempotencyKey, pollDocumentStatus } from "../poll";
import type { VoidedDocumentCreateInput } from "../types";
import {
  firstZodMessage,
  voidedFormSchema,
  zodFieldErrors,
} from "../validation";

interface VoidLine {
  document_type: string;
  serie_number: string;
  reason: string;
}

export function VoidedDocumentFormPage() {
  const navigate = useNavigate();
  const [idem] = useState(() => newIdempotencyKey());
  const [companyId, setCompanyId] = useState("");
  const [referenceDate, setReferenceDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [issueDate, setIssueDate] = useState("");
  const [lines, setLines] = useState<VoidLine[]>([
    { document_type: "01", serie_number: "", reason: "Error en datos" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketHint, setTicketHint] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });

  const payload: VoidedDocumentCreateInput = useMemo(
    () => ({
      company_id: companyId,
      reference_date: referenceDate,
      ...(issueDate ? { issue_date: issueDate } : {}),
      documents: lines.map((l) => ({
        document_type: l.document_type,
        serie_number: l.serie_number.trim().toUpperCase(),
        reason: l.reason,
      })),
    }),
    [companyId, referenceDate, issueDate, lines],
  );

  const formParsed = voidedFormSchema.safeParse({
    company_id: companyId || undefined,
    reference_date: referenceDate,
    documents: lines,
  });
  const formError = firstZodMessage(formParsed);
  const fieldErrors = zodFieldErrors<"company_id" | "reference_date">(
    formParsed,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (formError) return;
    setSubmitting(true);
    try {
      const doc = await emitVoidedDocument(payload, idem);
      setTicketHint(doc.sunat_ticket ?? doc.id);
      const final = await pollDocumentStatus(doc.id);
      navigate(`/documents/${final.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al emitir RA");
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
    <div className="space-y-6">
      <PageHeader
        title="Comunicación de baja (RA)"
        description="Anula comprobantes emitidos en la fecha de referencia."
        actions={
          <Link
            to="/documents"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon-label-sm" }),
            )}
            aria-label="Volver"
          >
            <ArrowLeft className={buttonIconClassName} />
            <ButtonLabel>Comprobantes</ButtonLabel>
          </Link>
        }
      />

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Datos generales</CardTitle>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  aria-invalid={touched && Boolean(fieldErrors.company_id)}
                >
                  <option value="">Seleccionar…</option>
                  {(companiesQuery.data ?? [])
                    .filter((c) => (c.status ?? "active") === "active")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.ruc} — {c.legal_name}
                      </option>
                    ))}
                </Select>
                {touched ? (
                  <FieldError message={fieldErrors.company_id} />
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Fecha referencia</Label>
                  <Input
                    type="date"
                    value={referenceDate}
                    onChange={(e) => setReferenceDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha emisión (opc.)</Label>
                  <Input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Idempotency-Key</Label>
                <Input readOnly value={idem} className="font-mono text-xs" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <CardTitle className="mb-0">Documentos a anular</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="icon-label-sm"
                aria-label="Agregar documento"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    {
                      document_type: "01",
                      serie_number: "",
                      reason: "Error en datos",
                    },
                  ])
                }
              >
                <Plus className={buttonIconClassName} />
                <ButtonLabel>Agregar</ButtonLabel>
              </Button>
            </div>
            <div className="space-y-3">
              {lines.map((line, i) => (
                <div
                  key={i}
                  className="grid gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-3 dark:border-gray-800"
                >
                  <Select
                    value={line.document_type}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, idx) =>
                          idx === i
                            ? { ...l, document_type: e.target.value }
                            : l,
                        ),
                      )
                    }
                  >
                    <option value="01">01 Factura</option>
                    <option value="03">03 Boleta</option>
                    <option value="07">07 NC</option>
                    <option value="08">08 ND</option>
                  </Select>
                  <Input
                    placeholder="F001-1"
                    value={line.serie_number}
                    aria-invalid={
                      touched &&
                      !/^[A-Za-z0-9]{1,4}-\d+$/.test(line.serie_number.trim())
                    }
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, idx) =>
                          idx === i
                            ? { ...l, serie_number: e.target.value }
                            : l,
                        ),
                      )
                    }
                  />
                  <Input
                    placeholder="Motivo"
                    value={line.reason}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, idx) =>
                          idx === i ? { ...l, reason: e.target.value } : l,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {touched && formError ? (
          <FieldError message={formError} />
        ) : null}
        {error ? (
          <p className="text-sm text-error-600 dark:text-error-500">{error}</p>
        ) : null}
        {ticketHint ? (
          <MutedText>
            Ticket / id: <span className="font-mono">{ticketHint}</span>
          </MutedText>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="submit"
            size="icon-label"
            aria-label={submitting ? "Enviando…" : "Emitir RA"}
            disabled={submitting || (touched && Boolean(formError))}
          >
            {submitting ? (
              <Loader2 className={`${buttonIconClassName} animate-spin`} />
            ) : (
              <Send className={buttonIconClassName} />
            )}
            <ButtonLabel>{submitting ? "Enviando…" : "Emitir RA"}</ButtonLabel>
          </Button>
        </div>
      </form>
    </div>
  );
}
