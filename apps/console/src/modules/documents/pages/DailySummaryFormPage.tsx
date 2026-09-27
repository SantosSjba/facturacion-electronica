import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Send } from "lucide-react";

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
import { Textarea } from "@/shared/ui/components/textarea";
import { cn } from "@/shared/ui/utils";

import { emitDailySummary, fetchCompanies } from "../api";
import { newIdempotencyKey, pollDocumentStatus } from "../poll";
import type { DailySummaryCreateInput } from "../types";
import {
  dailySummaryFormSchema,
  firstZodMessage,
  zodFieldErrors,
} from "../validation";

export function DailySummaryFormPage() {
  const navigate = useNavigate();
  const [idem] = useState(() => newIdempotencyKey());
  const [companyId, setCompanyId] = useState("");
  const [referenceDate, setReferenceDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [documentIds, setDocumentIds] = useState("");
  const [manualLines, setManualLines] = useState(
    "document_id,serie_number,status\n",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });

  const payload: DailySummaryCreateInput = useMemo(() => {
    const body: DailySummaryCreateInput = {
      company_id: companyId,
      reference_date: referenceDate,
    };
    if (mode === "auto") {
      const ids = documentIds
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length) body.document_ids = ids;
    } else {
      const lines = manualLines
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("document_id"))
        .map((l) => {
          const [document_id, serie_number, status] = l
            .split(",")
            .map((p) => p.trim());
          return {
            ...(document_id ? { document_id } : {}),
            ...(serie_number ? { serie_number } : {}),
            ...(status === "1" || status === "2" || status === "3"
              ? { status: status as "1" | "2" | "3" }
              : {}),
          };
        })
        .filter((l) => l.document_id || l.serie_number);
      if (lines.length) body.lines = lines;
    }
    return body;
  }, [companyId, referenceDate, mode, documentIds, manualLines]);

  const formParsed = dailySummaryFormSchema.safeParse({
    company_id: companyId || undefined,
    reference_date: referenceDate,
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
      const doc = await emitDailySummary(payload, idem);
      const final = await pollDocumentStatus(doc.id);
      navigate(`/documents/${final.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al emitir RC");
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
        title="Resumen diario (RC)"
        description="Modo auto (pool) o líneas manuales."
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
              <div className="space-y-1.5">
                <Label>Fecha referencia</Label>
                <Input
                  type="date"
                  value={referenceDate}
                  onChange={(e) => setReferenceDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Modo</Label>
                <Select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as "auto" | "manual")}
                >
                  <option value="auto">Auto (document_ids o pool vacío)</option>
                  <option value="manual">Manual (lines[])</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Idempotency-Key</Label>
                <Input readOnly value={idem} className="font-mono text-xs" />
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>
              {mode === "auto" ? "Documentos (auto)" : "Líneas manuales"}
            </CardTitle>
            {mode === "auto" ? (
              <div className="space-y-1.5">
                <Label>document_ids (opc., separados por coma)</Label>
                <Input
                  value={documentIds}
                  onChange={(e) => setDocumentIds(e.target.value)}
                  placeholder="uuid,uuid…"
                />
                <MutedText className="text-xs">
                  Vacío = pool pendiente del día de referencia.
                </MutedText>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Líneas CSV</Label>
                <Textarea
                  className="min-h-40 font-mono text-xs"
                  value={manualLines}
                  onChange={(e) => setManualLines(e.target.value)}
                />
              </div>
            )}
          </Card>
        </div>

        {touched && formError ? <FieldError message={formError} /> : null}
        {error ? (
          <p className="text-sm text-error-600 dark:text-error-500">{error}</p>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="submit"
            size="icon-label"
            aria-label={submitting ? "Enviando…" : "Emitir RC"}
            disabled={submitting || (touched && Boolean(formError))}
          >
            {submitting ? (
              <Loader2 className={`${buttonIconClassName} animate-spin`} />
            ) : (
              <Send className={buttonIconClassName} />
            )}
            <ButtonLabel>{submitting ? "Enviando…" : "Emitir RC"}</ButtonLabel>
          </Button>
        </div>
      </form>
    </div>
  );
}
