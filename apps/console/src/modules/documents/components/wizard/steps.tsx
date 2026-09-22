import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Plus, Trash2 } from "lucide-react";

import type { Company, DocumentSeries } from "@/modules/companies/types";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import { MutedText } from "@/shared/ui/components/muted-text";
import { FieldError } from "@/shared/ui/FieldError";

import { fetchSeries } from "../../api";
import type { CustomerInput, InvoiceLineInput } from "../../types";

export interface CommonHeaderState {
  company_id: string;
  serie: string;
  number: string;
  operation_type: string;
  issue_date: string;
  issue_time: string;
  due_date: string;
  currency: string;
  totals_mode: "auto" | "strict";
  purchase_order: string;
  idempotency_key: string;
}

function preventInvalidNumberKey(event: React.KeyboardEvent<HTMLInputElement>) {
  if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault();
}

export function emptyHeader(idempotencyKey: string): CommonHeaderState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    company_id: "",
    serie: "",
    number: "",
    operation_type: "0101",
    issue_date: today,
    issue_time: "",
    due_date: "",
    currency: "PEN",
    totals_mode: "auto",
    purchase_order: "",
    idempotency_key: idempotencyKey,
  };
}

export function emptyCustomer(): CustomerInput {
  return {
    identity_type: "6",
    identity_number: "",
    name: "",
    email: "",
  };
}

export function emptyLine(id = 1): InvoiceLineInput {
  return {
    id,
    quantity: 1,
    unit_code: "NIU",
    description: "",
    unit_value: 0,
    unit_price: undefined,
    tax_affectation: "10",
    igv_percent: 18,
    tax_scheme_id: "1000",
  };
}

export function HeaderStep({
  value,
  onChange,
  companies,
  documentType,
  seriePrefix,
  showOperationType = true,
  extra,
}: {
  value: CommonHeaderState;
  onChange: (next: CommonHeaderState) => void;
  companies: Company[];
  documentType: string;
  seriePrefix?: RegExp;
  showOperationType?: boolean;
  extra?: React.ReactNode;
}) {
  const seriesQuery = useQuery({
    queryKey: ["series", value.company_id],
    queryFn: () => fetchSeries(value.company_id),
    enabled: Boolean(value.company_id),
  });

  const series = (seriesQuery.data ?? []).filter((s: DocumentSeries) => {
    if (s.documentType !== documentType || !s.isActive) return false;
    if (seriePrefix && !seriePrefix.test(s.serie)) return false;
    return true;
  });

  useEffect(() => {
    if (!value.serie && series[0]) {
      onChange({ ...value, serie: series[0].serie });
    }
  }, [series, value, onChange]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Empresa</Label>
        <Select
          data-testid="wizard-company"
          value={value.company_id}
          onChange={(e) =>
            onChange({ ...value, company_id: e.target.value, serie: "" })
          }
        >
          <option value="">Seleccionar…</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.ruc} — {c.legal_name} ({c.environment})
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Serie</Label>
        <Select
          data-testid="wizard-serie"
          value={value.serie}
          onChange={(e) => onChange({ ...value, serie: e.target.value })}
          disabled={!value.company_id}
        >
          <option value="">Seleccionar…</option>
          {series.map((s) => (
            <option key={s.id} value={s.serie}>
              {s.serie} (next {s.nextNumber})
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Número (opcional)</Label>
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          min={1}
          value={value.number}
          onChange={(e) => onChange({ ...value, number: e.target.value.replace(/\D/g, "") })}
        />
      </div>
      {showOperationType ? (
        <div className="space-y-1.5">
          <Label>Tipo de operación</Label>
          <Input
            value={value.operation_type}
            onChange={(e) =>
              onChange({ ...value, operation_type: e.target.value.replace(/\D/g, "").slice(0, 4) })
            }
            inputMode="numeric"
            maxLength={4}
          />
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label>Fecha emisión</Label>
        <Input
          type="date"
          value={value.issue_date}
          onChange={(e) => onChange({ ...value, issue_date: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Hora (opcional)</Label>
        <Input
          type="time"
          step={1}
          value={value.issue_time}
          onChange={(e) => onChange({ ...value, issue_time: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Moneda</Label>
        <Select
          value={value.currency}
          onChange={(e) => onChange({ ...value, currency: e.target.value })}
        >
          <option value="PEN">PEN</option>
          <option value="USD">USD</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Totals mode</Label>
        <Select
          value={value.totals_mode}
          onChange={(e) =>
            onChange({
              ...value,
              totals_mode: e.target.value as "auto" | "strict",
            })
          }
        >
          <option value="auto">auto</option>
          <option value="strict">strict</option>
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Idempotency-Key</Label>
        <div className="flex gap-2">
          <Input readOnly value={value.idempotency_key} className="font-mono" />
          <Button
            type="button"
            variant="outline"
            size="icon-label-sm"
            aria-label="Copiar"
            onClick={() =>
              void navigator.clipboard.writeText(value.idempotency_key)
            }
          >
            <Copy className={buttonIconClassName} />
            <ButtonLabel>Copiar</ButtonLabel>
          </Button>
        </div>
      </div>
      {extra}
    </div>
  );
}

export function CustomerStep({
  value,
  onChange,
  identityHint,
}: {
  value: CustomerInput;
  onChange: (next: CustomerInput) => void;
  identityHint?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Tipo doc. identidad</Label>
        <Select
          value={value.identity_type}
          onChange={(e) =>
            onChange({ ...value, identity_type: e.target.value })
          }
        >
          <option value="6">6 RUC</option>
          <option value="1">1 DNI</option>
          <option value="4">4 Carnet extranjería</option>
          <option value="0">0 DOC.TRIB.NO.DOM.SIN.RUC</option>
        </Select>
        {identityHint ? (
          <MutedText className="text-xs">{identityHint}</MutedText>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label>Número</Label>
        <Input
          data-testid="wizard-customer-number"
          value={value.identity_number}
          inputMode={value.identity_type === "1" || value.identity_type === "6" ? "numeric" : "text"}
          maxLength={value.identity_type === "6" ? 11 : value.identity_type === "1" ? 8 : 20}
          aria-invalid={
            value.identity_number.length > 0 &&
            ((value.identity_type === "6" && !/^\d{11}$/.test(value.identity_number)) ||
              (value.identity_type === "1" && !/^\d{8}$/.test(value.identity_number)))
          }
          onChange={(e) =>
            onChange({
              ...value,
              identity_number:
                value.identity_type === "1" || value.identity_type === "6"
                  ? e.target.value.replace(/\D/g, "")
                  : e.target.value,
            })
          }
        />
        <FieldError
          message={
            value.identity_number.length > 0 && value.identity_type === "6" && !/^\d{11}$/.test(value.identity_number)
              ? "El RUC debe tener 11 dígitos"
              : value.identity_number.length > 0 && value.identity_type === "1" && !/^\d{8}$/.test(value.identity_number)
                ? "El DNI debe tener 8 dígitos"
                : undefined
          }
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Nombre / Razón social</Label>
        <Input
          data-testid="wizard-customer-name"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Email (opcional)</Label>
        <Input
          type="email"
          value={value.email ?? ""}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
        />
      </div>
    </div>
  );
}

export function LinesStep({
  lines,
  onChange,
}: {
  lines: InvoiceLineInput[];
  onChange: (next: InvoiceLineInput[]) => void;
}) {
  function update(i: number, patch: Partial<InvoiceLineInput>) {
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  return (
    <div className="space-y-4">
      {lines.map((line, i) => (
        <div
          key={line.id}
          className="grid gap-3 rounded-md border border-gray-200 p-3 sm:grid-cols-2 dark:border-gray-800"
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descripción</Label>
            <Input
              data-testid={i === 0 ? "wizard-line-description" : undefined}
              value={line.description}
              onChange={(e) => update(i, { description: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cantidad</Label>
            <Input
              type="number"
              min={0.0001}
              step="any"
              data-testid={i === 0 ? "wizard-line-quantity" : undefined}
              value={line.quantity}
              aria-invalid={line.quantity <= 0}
              onKeyDown={preventInvalidNumberKey}
              onChange={(e) =>
                update(i, { quantity: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Unidad</Label>
            <Input
              value={line.unit_code}
              onChange={(e) => update(i, { unit_code: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Valor unitario</Label>
            <Input
              type="number"
              min={0}
              step="any"
              data-testid={i === 0 ? "wizard-line-unit-value" : undefined}
              value={line.unit_value}
              aria-invalid={line.unit_value < 0}
              onKeyDown={preventInvalidNumberKey}
              onChange={(e) =>
                update(i, { unit_value: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Precio unitario (opc.)</Label>
            <Input
              type="number"
              min={0}
              step="any"
              value={line.unit_price ?? ""}
              onKeyDown={preventInvalidNumberKey}
              onChange={(e) =>
                update(i, {
                  unit_price: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Afectación IGV</Label>
            <Select
              value={line.tax_affectation}
              onChange={(e) => update(i, { tax_affectation: e.target.value })}
            >
              <option value="10">10 Gravado</option>
              <option value="20">20 Exonerado</option>
              <option value="30">30 Inafecto</option>
              <option value="40">40 Exportación</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>% IGV</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={line.igv_percent ?? ""}
              onKeyDown={preventInvalidNumberKey}
              onChange={(e) =>
                update(i, {
                  igv_percent: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            />
          </div>
          {lines.length > 1 ? (
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-label-sm"
                aria-label="Quitar línea"
                onClick={() => onChange(lines.filter((_, idx) => idx !== i))}
              >
                <Trash2 className={buttonIconClassName} />
                <ButtonLabel>Quitar línea</ButtonLabel>
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="icon-label"
        aria-label="Agregar línea"
        onClick={() =>
          onChange([
            ...lines,
            emptyLine(Math.max(...lines.map((l) => l.id), 0) + 1),
          ])
        }
      >
        <Plus className={buttonIconClassName} />
        <ButtonLabel>Agregar línea</ButtonLabel>
      </Button>
    </div>
  );
}

export function ReviewStep({
  payload,
  error,
}: {
  payload: unknown;
  error?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(payload, null, 2);

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-error-600 dark:text-error-500">{error}</p> : null}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="icon-label-sm"
          aria-label={copied ? "Copiado" : "Copiar JSON"}
          onClick={() => {
            void navigator.clipboard.writeText(json);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? (
            <Check className={buttonIconClassName} />
          ) : (
            <Copy className={buttonIconClassName} />
          )}
          <ButtonLabel>{copied ? "Copiado" : "Copiar JSON"}</ButtonLabel>
        </Button>
      </div>
      <pre className="max-h-96 overflow-auto rounded-md bg-gray-100 p-3 text-xs dark:bg-white/5">
        {json}
      </pre>
    </div>
  );
}
