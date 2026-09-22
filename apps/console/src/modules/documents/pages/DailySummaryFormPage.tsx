import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";

import { emitDailySummary, fetchCompanies } from "../api";
import { newIdempotencyKey, pollDocumentStatus } from "../poll";
import type { DailySummaryCreateInput } from "../types";

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Resumen diario (RC)"
        description="Modo auto (pool) o líneas manuales."
      />
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Empresa</Label>
          <Select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            required
          >
            <option value="">Seleccionar…</option>
            {(companiesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.ruc} — {c.legal_name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Fecha referencia</Label>
          <Input
            type="date"
            value={referenceDate}
            onChange={(e) => setReferenceDate(e.target.value)}
            required
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

        {mode === "auto" ? (
          <div className="space-y-1.5">
            <Label>document_ids (opc., separados por coma)</Label>
            <Input
              value={documentIds}
              onChange={(e) => setDocumentIds(e.target.value)}
              placeholder="uuid,uuid…"
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Vacío = pool pendiente del día de referencia.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Líneas CSV</Label>
            <textarea
              className="min-h-32 w-full rounded-md border border-[var(--input)] bg-[var(--card)] p-3 font-mono text-xs"
              value={manualLines}
              onChange={(e) => setManualLines(e.target.value)}
            />
          </div>
        )}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" disabled={submitting || !companyId}>
          {submitting ? "Enviando…" : "Emitir RC"}
        </Button>
      </form>
    </div>
  );
}
