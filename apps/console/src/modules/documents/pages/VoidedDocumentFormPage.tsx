import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { MutedText } from "@/shared/ui/components/muted-text";
import { Select } from "@/shared/ui/components/select";

import { emitVoidedDocument, fetchCompanies } from "../api";
import { newIdempotencyKey, pollDocumentStatus } from "../poll";
import type { VoidedDocumentCreateInput } from "../types";

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Comunicación de baja (RA)"
        description="Anula comprobantes emitidos en la fecha de referencia."
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
        <div className="grid gap-4 sm:grid-cols-2">
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

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Documentos a anular</h2>
          {lines.map((line, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-md border border-gray-200 p-3 sm:grid-cols-3 dark:border-gray-800"
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
                <option value="01">01</option>
                <option value="03">03</option>
                <option value="07">07</option>
                <option value="08">08</option>
              </Select>
              <Input
                placeholder="F001-1"
                value={line.serie_number}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l, idx) =>
                      idx === i
                        ? { ...l, serie_number: e.target.value }
                        : l,
                    ),
                  )
                }
                required
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
                required
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
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
            Agregar documento
          </Button>
        </div>

        {error ? <p className="text-sm text-error-600 dark:text-error-500">{error}</p> : null}
        {ticketHint ? (
          <MutedText>
            Ticket / id: <span className="font-mono">{ticketHint}</span>
          </MutedText>
        ) : null}

        <Button type="submit" disabled={submitting || !companyId}>
          {submitting ? "Enviando…" : "Emitir RA"}
        </Button>
      </form>
    </div>
  );
}
