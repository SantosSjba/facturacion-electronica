import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { ApiError } from "@/shared/api/errors";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";
import { TextLink } from "@/shared/ui/components/text-link";
import { ErrorState } from "@/shared/ui/ErrorState";
import { FieldError } from "@/shared/ui/FieldError";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";

import { createCompany, fetchCompany, patchCompany } from "../api";
import type { CompanyEnvironment } from "../types";

const companySchema = z.object({
  ruc: z.string().regex(/^\d{11}$/, "El RUC debe contener exactamente 11 dígitos"),
  legalName: z.string().trim().min(2, "Ingresa una razón social válida").max(200, "Máximo 200 caracteres"),
  tradeName: z.string().trim().max(200, "Máximo 200 caracteres"),
  addressLine: z.string().trim().max(250, "Máximo 250 caracteres"),
  ubigeo: z.string().refine((value) => value === "" || /^\d{6}$/.test(value), "El ubigeo debe contener 6 dígitos"),
  timezone: z.string().trim().min(1, "Selecciona una zona horaria"),
});

type CompanyField = keyof z.infer<typeof companySchema>;

export function CompanyFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const existingQuery = useQuery({
    queryKey: ["company", id],
    queryFn: () => fetchCompany(id ?? ""),
    enabled: mode === "edit" && Boolean(id),
  });

  const [ruc, setRuc] = useState("");
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [environment, setEnvironment] =
    useState<CompanyEnvironment>("sandbox");
  const [addressLine, setAddressLine] = useState("");
  const [ubigeo, setUbigeo] = useState("");
  const [timezone, setTimezone] = useState("America/Lima");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CompanyField, string>>>({});

  useEffect(() => {
    const existing = existingQuery.data;
    if (mode !== "edit" || !existing) return;
    setRuc(existing.ruc);
    setLegalName(existing.legal_name);
    setTradeName(existing.trade_name ?? "");
    setEnvironment(existing.environment as CompanyEnvironment);
    const addr = (existing.address ?? {}) as Record<string, unknown>;
    setAddressLine(typeof addr.line === "string" ? addr.line : "");
    setUbigeo(typeof addr.ubigeo === "string" ? addr.ubigeo : "");
    setTimezone(existing.timezone || "America/Lima");
  }, [mode, existingQuery.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const address =
        addressLine || ubigeo
          ? { line: addressLine || undefined, ubigeo: ubigeo || undefined }
          : null;
      if (mode === "create") {
        return createCompany({
          ruc,
          legal_name: legalName,
          trade_name: tradeName || null,
          environment,
          address,
          timezone,
        });
      }
      return patchCompany(id ?? "", {
        legal_name: legalName,
        trade_name: tradeName || null,
        address,
        timezone,
      });
    },
    onSuccess: async (company) => {
      await qc.invalidateQueries({ queryKey: ["companies"] });
      await qc.invalidateQueries({ queryKey: ["company", company.id] });
      navigate(`/companies/${company.id}/overview`);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Error al guardar");
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = companySchema.safeParse({ ruc, legalName, tradeName, addressLine, ubigeo, timezone });
    if (!result.success) {
      const nextErrors: Partial<Record<CompanyField, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as CompanyField;
        if (!nextErrors[field]) nextErrors[field] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    mutation.mutate();
  }

  if (mode === "edit" && existingQuery.isLoading) {
    return <LoadingState label="Cargando empresa…" />;
  }

  if (mode === "edit" && existingQuery.error) {
    return (
      <ErrorState
        message={
          existingQuery.error instanceof Error
            ? existingQuery.error.message
            : "Empresa no encontrada"
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={mode === "create" ? "Crear empresa" : "Editar empresa"}
        description={
          mode === "create"
            ? "RUC y ambiente no se pueden cambiar después."
            : "RUC y ambiente son inmutables."
        }
        actions={
          <TextLink
            to={
              mode === "edit" && id ? `/companies/${id}/overview` : "/companies"
            }
            className="text-sm"
          >
            Cancelar
          </TextLink>
        }
      />

      <form
        className="max-w-xl space-y-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]"
        onSubmit={(e) => void onSubmit(e)}
      >
        <div className="space-y-1.5">
          <Label htmlFor="ruc">RUC</Label>
          <Input
            id="ruc"
            required={mode === "create"}
            pattern="\d{11}"
            maxLength={11}
            value={ruc}
            disabled={mode === "edit"}
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={Boolean(fieldErrors.ruc)}
            aria-describedby={fieldErrors.ruc ? "ruc-error" : undefined}
            onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))}
          />
          <FieldError id="ruc-error" message={fieldErrors.ruc} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="legal_name">Razón social</Label>
          <Input
            id="legal_name"
            required
            value={legalName}
            aria-invalid={Boolean(fieldErrors.legalName)}
            onChange={(e) => setLegalName(e.target.value)}
          />
          <FieldError message={fieldErrors.legalName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="trade_name">Nombre comercial</Label>
          <Input
            id="trade_name"
            value={tradeName}
            aria-invalid={Boolean(fieldErrors.tradeName)}
            onChange={(e) => setTradeName(e.target.value)}
          />
          <FieldError message={fieldErrors.tradeName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="environment">Ambiente</Label>
          <Select
            id="environment"
            value={environment}
            disabled={mode === "edit"}
            onChange={(e) =>
              setEnvironment(e.target.value as CompanyEnvironment)
            }
          >
            <option value="sandbox">sandbox</option>
            <option value="production">production</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address_line">Dirección</Label>
          <Input
            id="address_line"
            value={addressLine}
            aria-invalid={Boolean(fieldErrors.addressLine)}
            onChange={(e) => setAddressLine(e.target.value)}
          />
          <FieldError message={fieldErrors.addressLine} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ubigeo">Ubigeo</Label>
          <Input
            id="ubigeo"
            value={ubigeo}
            inputMode="numeric"
            maxLength={6}
            placeholder="150101"
            aria-invalid={Boolean(fieldErrors.ubigeo)}
            onChange={(e) => setUbigeo(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <FieldError message={fieldErrors.ubigeo} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            value={timezone}
            aria-invalid={Boolean(fieldErrors.timezone)}
            onChange={(e) => setTimezone(e.target.value)}
          />
          <FieldError message={fieldErrors.timezone} />
        </div>

        {error ? <ErrorState title="Error" message={error} /> : null}

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Guardando…" : "Guardar"}
        </Button>
      </form>
    </div>
  );
}
