import { Spinner } from "@factosys/ui";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { ApiError } from "@/shared/api/errors";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Checkbox,
  Input,
  Label,
  MutedText,
  Select,
  ErrorState,
  FieldError,
  LoadingState,
} from "@factosys/ui";

import { toast } from "@/shared/ui/toaster";

import { createCompany, fetchCompany, patchCompany } from "../api";
import { DEFAULT_COMPANY_SERIES } from "../default-series";
import type { CompanyEnvironment } from "../types";
import { useCompanyCapacity } from "../use-company-capacity";

const companySchema = z.object({
  ruc: z.string().regex(/^\d{11}$/, "El RUC debe contener exactamente 11 dígitos"),
  legalName: z
    .string()
    .trim()
    .min(2, "Ingresa una razón social válida")
    .max(200, "Máximo 200 caracteres"),
  tradeName: z.string().trim().max(200, "Máximo 200 caracteres"),
  addressLine: z.string().trim().max(250, "Máximo 250 caracteres"),
  ubigeo: z
    .string()
    .refine((value) => value === "" || /^\d{6}$/.test(value), "El ubigeo debe contener 6 dígitos"),
  timezone: z.string().trim().min(1, "Selecciona una zona horaria"),
});

type CompanyField = keyof z.infer<typeof companySchema>;

type CompanyFormDialogProps =
  | {
      open: boolean;
      onClose: () => void;
      mode: "create";
      companyId?: undefined;
    }
  | {
      open: boolean;
      onClose: () => void;
      mode: "edit";
      companyId: string;
    };

function digitsOnly(raw: string, max: number, toastId: string, message: string): string {
  const cleaned = raw.replace(/\D/g, "").slice(0, max);
  if (/\D/.test(raw)) {
    toast.warning(message, { id: toastId });
  }
  return cleaned;
}

export function CompanyFormDialog(props: CompanyFormDialogProps) {
  const { open, onClose, mode } = props;
  const companyId = mode === "edit" ? props.companyId : undefined;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const hydratedOpenRef = useRef(false);
  const capacity = useCompanyCapacity(open && mode === "create");

  const existingQuery = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => fetchCompany(companyId ?? ""),
    enabled: open && mode === "edit" && Boolean(companyId),
  });

  const [ruc, setRuc] = useState("");
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [environment, setEnvironment] = useState<CompanyEnvironment>("sandbox");
  const [addressLine, setAddressLine] = useState("");
  const [ubigeo, setUbigeo] = useState("");
  const [timezone, setTimezone] = useState("America/Lima");
  const [seedDefaultSeries, setSeedDefaultSeries] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CompanyField, string>>>({});

  function resetForm() {
    setRuc("");
    setLegalName("");
    setTradeName("");
    setEnvironment("sandbox");
    setAddressLine("");
    setUbigeo("");
    setTimezone("America/Lima");
    setSeedDefaultSeries(true);
    setFieldErrors({});
  }

  // Reset / hydrate only when the dialog opens (or edit data arrives) — never while typing.
  useEffect(() => {
    if (!open) {
      hydratedOpenRef.current = false;
      return;
    }

    if (mode === "create") {
      if (!hydratedOpenRef.current) {
        resetForm();
        hydratedOpenRef.current = true;
      }
      return;
    }

    const existing = existingQuery.data;
    if (!existing) return;
    setRuc(existing.ruc);
    setLegalName(existing.legal_name);
    setTradeName(existing.trade_name ?? "");
    setEnvironment(existing.environment as CompanyEnvironment);
    const addr = (existing.address ?? {}) as Record<string, unknown>;
    setAddressLine(typeof addr.line === "string" ? addr.line : "");
    setUbigeo(typeof addr.ubigeo === "string" ? addr.ubigeo : "");
    setTimezone(existing.timezone || "America/Lima");
    setFieldErrors({});
    hydratedOpenRef.current = true;
  }, [open, mode, existingQuery.data]);

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
          seed_default_series: seedDefaultSeries,
        });
      }
      return patchCompany(companyId ?? "", {
        environment,
        legal_name: legalName,
        trade_name: tradeName || null,
        address,
        timezone,
      });
    },
    onSuccess: async (company) => {
      await qc.invalidateQueries({ queryKey: ["companies"] });
      await qc.invalidateQueries({ queryKey: ["org-plan"] });
      await qc.invalidateQueries({ queryKey: ["company", company.id] });
      toast.success(mode === "create" ? "Empresa creada" : "Empresa actualizada", {
        description:
          mode === "create" && seedDefaultSeries
            ? `${company.legal_name} · series iniciales listas`
            : company.legal_name,
      });
      onClose();
      if (mode === "create") {
        navigate(
          seedDefaultSeries
            ? `/app/companies/${company.id}/series`
            : `/app/companies/${company.id}/overview`,
        );
      }
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Error al guardar";
      toast.error(message);
      if (mode === "create") void qc.invalidateQueries({ queryKey: ["org-plan"] });
    },
  });

  function handleClose() {
    if (mutation.isPending) return;
    onClose();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mutation.isPending || (mode === "create" && capacity.blocked)) return;
    const result = companySchema.safeParse({
      ruc,
      legalName,
      tradeName,
      addressLine,
      ubigeo,
      timezone,
    });
    if (!result.success) {
      const nextErrors: Partial<Record<CompanyField, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as CompanyField;
        if (!nextErrors[field]) nextErrors[field] = issue.message;
      }
      setFieldErrors(nextErrors);
      const first = result.error.issues[0]?.message ?? "Revisa el formulario";
      toast.error("Datos inválidos", { description: first });
      return;
    }
    setFieldErrors({});
    mutation.mutate();
  }

  const loadingEdit = mode === "edit" && existingQuery.isLoading;
  const editError = mode === "edit" && existingQuery.error;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      ariaLabel={mode === "create" ? "Crear empresa" : "Editar empresa"}
      size="lg"
      closeOnBackdrop={!mutation.isPending}
    >
      <form onSubmit={(e) => void onSubmit(e)} noValidate>
        <DialogHeader
          title={mode === "create" ? "Crear empresa" : "Editar empresa"}
          description={
            mode === "create"
              ? "El RUC no se puede cambiar después. Puedes cambiar el ambiente."
              : "El cambio de ambiente se aplica a los nuevos documentos. El RUC no se puede cambiar."
          }
          onClose={handleClose}
        />
        <DialogBody className="space-y-4">
          {loadingEdit ? <LoadingState variant="form" label="Cargando empresa…" /> : null}
          {editError ? (
            <ErrorState
              message={
                existingQuery.error instanceof Error
                  ? existingQuery.error.message
                  : "Empresa no encontrada"
              }
            />
          ) : null}
          {!loadingEdit && !editError ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="company-ruc">RUC</Label>
                  <Input
                    id="company-ruc"
                    required={mode === "create"}
                    maxLength={11}
                    value={ruc}
                    disabled={mode === "edit"}
                    inputMode="numeric"
                    autoComplete="off"
                    aria-invalid={Boolean(fieldErrors.ruc)}
                    aria-describedby={fieldErrors.ruc ? "company-ruc-error" : undefined}
                    onChange={(e) =>
                      setRuc(
                        digitsOnly(
                          e.target.value,
                          11,
                          "ruc-digits",
                          "El RUC solo acepta dígitos (11 números).",
                        ),
                      )
                    }
                  />
                  <FieldError id="company-ruc-error" message={fieldErrors.ruc} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="company-legal-name">Razón social</Label>
                  <Input
                    id="company-legal-name"
                    required
                    value={legalName}
                    aria-invalid={Boolean(fieldErrors.legalName)}
                    onChange={(e) => {
                      setLegalName(e.target.value);
                      if (fieldErrors.legalName) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          legalName: undefined,
                        }));
                      }
                    }}
                  />
                  <FieldError message={fieldErrors.legalName} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company-trade-name">Nombre comercial</Label>
                  <Input
                    id="company-trade-name"
                    value={tradeName}
                    aria-invalid={Boolean(fieldErrors.tradeName)}
                    onChange={(e) => setTradeName(e.target.value)}
                  />
                  <FieldError message={fieldErrors.tradeName} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company-environment">Ambiente</Label>
                  <Select
                    id="company-environment"
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value as CompanyEnvironment)}
                  >
                    <option value="sandbox">Pruebas</option>
                    <option value="production">Producción</option>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="company-address">Dirección</Label>
                  <Input
                    id="company-address"
                    value={addressLine}
                    aria-invalid={Boolean(fieldErrors.addressLine)}
                    onChange={(e) => setAddressLine(e.target.value)}
                  />
                  <FieldError message={fieldErrors.addressLine} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company-ubigeo">Ubigeo</Label>
                  <Input
                    id="company-ubigeo"
                    value={ubigeo}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="150101"
                    aria-invalid={Boolean(fieldErrors.ubigeo)}
                    onChange={(e) =>
                      setUbigeo(
                        digitsOnly(
                          e.target.value,
                          6,
                          "ubigeo-digits",
                          "El ubigeo solo acepta dígitos (6 números).",
                        ),
                      )
                    }
                  />
                  <FieldError message={fieldErrors.ubigeo} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company-timezone">Zona horaria</Label>
                  <Input
                    id="company-timezone"
                    value={timezone}
                    aria-invalid={Boolean(fieldErrors.timezone)}
                    onChange={(e) => setTimezone(e.target.value)}
                  />
                  <FieldError message={fieldErrors.timezone} />
                </div>
              </div>

              {mode === "create" ? (
                <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                  <label className="flex cursor-pointer items-start gap-3">
                    <Checkbox
                      className="mt-0.5"
                      checked={seedDefaultSeries}
                      onChange={(e) => setSeedDefaultSeries(e.target.checked)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-800 dark:text-white/90">
                        Crear series iniciales
                      </span>
                      <MutedText className="mt-0.5 block text-theme-xs">
                        F001, B001, FC01, FD01, T001 y V001 (correlativo 1). RA/RC se crean al
                        emitir.
                      </MutedText>
                    </span>
                  </label>
                  {seedDefaultSeries ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {DEFAULT_COMPANY_SERIES.map((s) => (
                        <span
                          key={`${s.document_type}-${s.serie}`}
                          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-theme-xs font-medium text-gray-700 dark:bg-white/5 dark:text-gray-300"
                        >
                          <span className="font-mono">{s.serie}</span>
                          <span className="text-gray-400">·</span>
                          {s.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {mode === "create" && capacity.blocked && capacity.message ? (
                <MutedText>{capacity.message}</MutedText>
              ) : null}
            </>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="icon-label-sm"
            aria-label="Cancelar"
            disabled={mutation.isPending}
            onClick={handleClose}
          >
            <X className={buttonIconClassName} />
            <ButtonLabel>Cancelar</ButtonLabel>
          </Button>
          <Button
            type="submit"
            size="icon-label-sm"
            aria-label={mode === "create" ? "Crear" : "Guardar"}
            disabled={
              mutation.isPending ||
              loadingEdit ||
              Boolean(editError) ||
              (mode === "create" && capacity.blocked)
            }
          >
            {mutation.isPending ? (
              <Spinner className={buttonIconClassName} />
            ) : mode === "create" ? (
              <Plus className={buttonIconClassName} />
            ) : (
              <Save className={buttonIconClassName} />
            )}
            <ButtonLabel>
              {mutation.isPending
                ? mode === "create"
                  ? "Creando…"
                  : "Guardando…"
                : mode === "create"
                  ? "Crear"
                  : "Guardar"}
            </ButtonLabel>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
