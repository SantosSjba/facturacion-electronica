import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";

import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";
import { FieldError } from "@/shared/ui/FieldError";
import { cn } from "@/shared/ui/utils";
import { fetchCompanies } from "@/modules/companies/api";

import type { CpeValidationInput } from "../types";

const DOC_TYPES = [
  { value: "01", label: "01 Factura" },
  { value: "03", label: "03 Boleta" },
  { value: "07", label: "07 Nota de crédito" },
  { value: "08", label: "08 Nota de débito" },
] as const;

export function CpeValidationForm({
  disabled,
  onSubmit,
  submitting,
}: {
  disabled?: boolean;
  submitting?: boolean;
  onSubmit: (input: CpeValidationInput) => void;
}) {
  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });

  const [companyId, setCompanyId] = useState("");
  const [ruc, setRuc] = useState("");
  const [documentType, setDocumentType] = useState("01");
  const [serie, setSerie] = useState("");
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!companyId) next.company_id = "Selecciona una empresa";
    if (!/^\d{11}$/.test(ruc.trim())) next.ruc = "RUC debe tener 11 dígitos";
    if (!serie.trim()) next.serie = "Serie requerida";
    if (!number.trim()) next.number = "Número requerido";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate))
      next.issue_date = "Fecha inválida";
    const total = Number(totalAmount);
    if (!Number.isFinite(total) || total < 0)
      next.total_amount = "Monto inválido";
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({
      company_id: companyId,
      ruc: ruc.trim(),
      document_type: documentType,
      serie: serie.trim(),
      number: number.trim(),
      issue_date: issueDate,
      total_amount: total,
    });
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cpe-company">Empresa</Label>
          <Select
            id="cpe-company"
            value={companyId}
            disabled={disabled || companiesQuery.isLoading}
            onChange={(e) => setCompanyId(e.target.value)}
            aria-invalid={Boolean(fieldErrors.company_id)}
          >
            <option value="">Seleccionar…</option>
            {(companiesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.legal_name ?? c.trade_name ?? c.ruc} ({c.ruc})
              </option>
            ))}
          </Select>
          <FieldError message={fieldErrors.company_id} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cpe-ruc">RUC emisor</Label>
          <Input
            id="cpe-ruc"
            value={ruc}
            maxLength={11}
            disabled={disabled}
            onChange={(e) => setRuc(e.target.value.replace(/\D/g, ""))}
            aria-invalid={Boolean(fieldErrors.ruc)}
          />
          <FieldError message={fieldErrors.ruc} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cpe-type">Tipo</Label>
          <Select
            id="cpe-type"
            value={documentType}
            disabled={disabled}
            onChange={(e) => setDocumentType(e.target.value)}
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cpe-serie">Serie</Label>
          <Input
            id="cpe-serie"
            value={serie}
            disabled={disabled}
            onChange={(e) => setSerie(e.target.value.toUpperCase())}
            aria-invalid={Boolean(fieldErrors.serie)}
          />
          <FieldError message={fieldErrors.serie} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cpe-number">Número</Label>
          <Input
            id="cpe-number"
            value={number}
            disabled={disabled}
            onChange={(e) => setNumber(e.target.value)}
            aria-invalid={Boolean(fieldErrors.number)}
          />
          <FieldError message={fieldErrors.number} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cpe-date">Fecha emisión</Label>
          <Input
            id="cpe-date"
            type="date"
            value={issueDate}
            disabled={disabled}
            onChange={(e) => setIssueDate(e.target.value)}
            aria-invalid={Boolean(fieldErrors.issue_date)}
          />
          <FieldError message={fieldErrors.issue_date} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cpe-total">Total</Label>
          <Input
            id="cpe-total"
            type="number"
            step="0.01"
            min="0"
            value={totalAmount}
            disabled={disabled}
            onChange={(e) => setTotalAmount(e.target.value)}
            aria-invalid={Boolean(fieldErrors.total_amount)}
          />
          <FieldError message={fieldErrors.total_amount} />
        </div>
      </div>
      <Button
        type="submit"
        size="icon-label"
        aria-label="Consultar validez"
        disabled={disabled || submitting}
      >
        {submitting ? (
          <Loader2 className={cn(buttonIconClassName, "animate-spin")} />
        ) : (
          <Search className={buttonIconClassName} />
        )}
        <ButtonLabel>
          {submitting ? "Consultando…" : "Consultar validez"}
        </ButtonLabel>
      </Button>
    </form>
  );
}
