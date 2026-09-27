import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";

import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import { Card, CardTitle } from "@/shared/ui/components/card";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";
import { FieldError } from "@/shared/ui/FieldError";
import { cn } from "@/shared/ui/utils";
import { fetchCompanies } from "@/modules/companies/api";

import type { CpeValidationInput } from "../types";
import { cpeValidationSchema, zodFieldErrors } from "../validation";

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
  const [touched, setTouched] = useState(false);

  const total = Number(totalAmount);
  const fieldErrors = zodFieldErrors(
    cpeValidationSchema.safeParse({
      company_id: companyId || undefined,
      ruc: ruc.trim(),
      document_type: documentType,
      serie: serie.trim(),
      number: number.trim(),
      issue_date: issueDate,
      total_amount: Number.isFinite(total) ? total : Number.NaN,
    }),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(fieldErrors).length > 0) return;
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

  function err(key: string) {
    return touched ? fieldErrors[key] : undefined;
  }

  return (
    <Card>
      <CardTitle>Consulta de validez</CardTitle>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cpe-company">Empresa</Label>
            <Select
              id="cpe-company"
              value={companyId}
              disabled={disabled || companiesQuery.isLoading}
              onChange={(e) => {
                setTouched(true);
                setCompanyId(e.target.value);
              }}
              aria-invalid={Boolean(err("company_id"))}
            >
              <option value="">Seleccionar…</option>
              {(companiesQuery.data ?? [])
                .filter((c) => (c.status ?? "active") === "active")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.legal_name ?? c.trade_name ?? c.ruc} ({c.ruc})
                  </option>
                ))}
            </Select>
            <FieldError message={err("company_id")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpe-ruc">RUC emisor</Label>
            <Input
              id="cpe-ruc"
              value={ruc}
              maxLength={11}
              disabled={disabled}
              onChange={(e) => {
                setTouched(true);
                setRuc(e.target.value.replace(/\D/g, ""));
              }}
              aria-invalid={Boolean(err("ruc"))}
            />
            <FieldError message={err("ruc")} />
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
              onChange={(e) => {
                setTouched(true);
                setSerie(e.target.value.toUpperCase());
              }}
              aria-invalid={Boolean(err("serie"))}
            />
            <FieldError message={err("serie")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpe-number">Número</Label>
            <Input
              id="cpe-number"
              value={number}
              disabled={disabled}
              onChange={(e) => {
                setTouched(true);
                setNumber(e.target.value.replace(/\D/g, ""));
              }}
              aria-invalid={Boolean(err("number"))}
            />
            <FieldError message={err("number")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpe-date">Fecha emisión</Label>
            <Input
              id="cpe-date"
              type="date"
              value={issueDate}
              disabled={disabled}
              onChange={(e) => {
                setTouched(true);
                setIssueDate(e.target.value);
              }}
              aria-invalid={Boolean(err("issue_date"))}
            />
            <FieldError message={err("issue_date")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpe-total">Importe total</Label>
            <Input
              id="cpe-total"
              type="number"
              min={0}
              step="0.01"
              value={totalAmount}
              disabled={disabled}
              onChange={(e) => {
                setTouched(true);
                setTotalAmount(e.target.value);
              }}
              aria-invalid={Boolean(err("total_amount"))}
            />
            <FieldError message={err("total_amount")} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            size="icon-label"
            aria-label={submitting ? "Consultando…" : "Consultar"}
            disabled={disabled || submitting}
          >
            {submitting ? (
              <Loader2 className={cn(buttonIconClassName, "animate-spin")} />
            ) : (
              <Search className={buttonIconClassName} />
            )}
            <ButtonLabel>
              {submitting ? "Consultando…" : "Consultar"}
            </ButtonLabel>
          </Button>
        </div>
      </form>
    </Card>
  );
}
