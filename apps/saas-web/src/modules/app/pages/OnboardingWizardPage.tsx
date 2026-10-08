import { Spinner } from "@factosys/ui";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Building2, Check, Scale, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
  Card,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  ErrorState,
  FieldError,
  LoadingState,
  cn,
} from "@factosys/ui";

import {
  acceptOnboardingLegal,
  createCompany,
  fetchOnboardingLegal,
  fetchOnboardingStatus,
} from "../api/onboarding";

const STEPS = ["Bienvenida", "Empresa", "Legal", "Listo"] as const;

export function OnboardingWizardPage() {
  const { user, logout } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ruc, setRuc] = useState("");
  const [legalName, setLegalName] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["onboarding-status", user?.organizationId],
    queryFn: fetchOnboardingStatus,
    enabled: Boolean(user),
  });

  const legalQuery = useQuery({
    queryKey: ["onboarding-legal"],
    queryFn: fetchOnboardingLegal,
    enabled: Boolean(user) && step >= 2,
  });

  useEffect(() => {
    if (!statusQuery.data || bootstrapped) return;
    const s = statusQuery.data;
    if (s.hints?.ruc) setRuc(s.hints.ruc);
    if (s.hints?.company_name) setLegalName(s.hints.company_name);
    if (s.legal.privacy && s.legal.terms && s.has_company) {
      setStep(3);
    } else if (s.has_company) {
      setStep(2);
    }
    setBootstrapped(true);
  }, [statusQuery.data, bootstrapped]);

  const privacyDoc = useMemo(
    () => legalQuery.data?.items.find((d) => d.code === "privacy.es-PE"),
    [legalQuery.data],
  );
  const termsDoc = useMemo(
    () => legalQuery.data?.items.find((d) => d.code === "terms.es-PE"),
    [legalQuery.data],
  );

  const companyMutation = useMutation({
    mutationFn: () =>
      createCompany({
        ruc: ruc.trim(),
        legal_name: legalName.trim(),
        environment,
        seed_default_series: true,
      }),
    onSuccess: async () => {
      toast.success("Empresa creada");
      setError(null);
      await qc.invalidateQueries({ queryKey: ["onboarding-status"] });
      setStep(2);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo crear la empresa",
      );
    },
  });

  const legalMutation = useMutation({
    mutationFn: () => {
      if (!privacyDoc || !termsDoc) {
        throw new Error("Documentos legales no disponibles");
      }
      return acceptOnboardingLegal([privacyDoc.id, termsDoc.id]);
    },
    onSuccess: async () => {
      toast.success("Términos aceptados");
      setError(null);
      await qc.invalidateQueries({ queryKey: ["onboarding-status"] });
      setStep(3);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo registrar la aceptación",
      );
    },
  });

  if (statusQuery.isLoading && !bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState variant="form" label="Cargando onboarding…" />
      </div>
    );
  }
  if (statusQuery.error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <ErrorState
          message={statusQuery.error instanceof Error ? statusQuery.error.message : "Error"}
          onRetry={() => void statusQuery.refetch()}
        />
      </div>
    );
  }

  const orgName = statusQuery.data?.organization_name ?? "tu organización";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 dark:bg-gray-900">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-theme-xs font-medium uppercase tracking-wide text-brand-500">
              Onboarding
            </p>
            <h1 className="text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
              Configura {orgName}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Completa estos pasos para entrar al panel.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void logout()}>
            Salir
          </Button>
        </div>

        <ol className="flex flex-wrap gap-2">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={cn(
                "rounded-full px-3 py-1 text-theme-xs font-medium",
                i === step
                  ? "bg-brand-500 text-white"
                  : i < step
                    ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400"
                    : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
              )}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        {error ? <FieldError message={error} /> : null}

        <Card className="space-y-5">
          {step === 0 ? (
            <div className="space-y-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
                <Sparkles className="size-6" />
              </div>
              <CardTitle>Bienvenido a Factosys</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Tu organización <strong>{orgName}</strong> ya está creada. En los siguientes pasos
                registrarás tu primera empresa (RUC) y aceptarás los términos legales.
              </p>
              <Button type="button" data-testid="onb-welcome-next" onClick={() => setStep(1)}>
                <ButtonLabel>Continuar</ButtonLabel>
                <ArrowRight className={buttonIconClassName} />
              </Button>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
                <Building2 className="size-6" />
              </div>
              <CardTitle>Primera empresa</CardTitle>
              {statusQuery.data?.has_company ? (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Ya tienes una empresa registrada.
                </p>
              ) : (
                <>
                  <div>
                    <Label htmlFor="onb-ruc">RUC</Label>
                    <Input
                      id="onb-ruc"
                      data-testid="onb-ruc"
                      value={ruc}
                      onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))}
                      inputMode="numeric"
                      placeholder="20123456789"
                    />
                  </div>
                  <div>
                    <Label htmlFor="onb-name">Razón social</Label>
                    <Input
                      id="onb-name"
                      data-testid="onb-legal-name"
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="onb-env">Ambiente</Label>
                    <Select
                      id="onb-env"
                      data-testid="onb-env"
                      value={environment}
                      onChange={(e) => setEnvironment(e.target.value as "sandbox" | "production")}
                    >
                      <option value="sandbox">Sandbox</option>
                      <option value="production">Producción</option>
                    </Select>
                  </div>
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(0)}>
                  <ArrowLeft className={buttonIconClassName} />
                  <ButtonLabel>Atrás</ButtonLabel>
                </Button>
                {statusQuery.data?.has_company ? (
                  <Button type="button" onClick={() => setStep(2)}>
                    <ButtonLabel>Continuar</ButtonLabel>
                    <ArrowRight className={buttonIconClassName} />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    data-testid="onb-create-company"
                    disabled={companyMutation.isPending || ruc.length !== 11 || !legalName.trim()}
                    onClick={() => {
                      setError(null);
                      companyMutation.mutate();
                    }}
                  >
                    {companyMutation.isPending ? <Spinner className={buttonIconClassName} /> : null}
                    <ButtonLabel>
                      {companyMutation.isPending ? "Creando…" : "Crear empresa"}
                    </ButtonLabel>
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
                <Scale className="size-6" />
              </div>
              <CardTitle>Términos legales</CardTitle>
              {legalQuery.isLoading ? (
                <LoadingState variant="documents" label="Cargando documentos…" />
              ) : legalQuery.error ? (
                <ErrorState
                  message="No se pudieron cargar los documentos"
                  onRetry={() => void legalQuery.refetch()}
                />
              ) : (
                <>
                  {[privacyDoc, termsDoc].filter(Boolean).map((doc) => (
                    <div
                      key={doc!.id}
                      className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm whitespace-pre-wrap text-gray-700 dark:border-gray-700 dark:bg-white/5 dark:text-gray-200"
                    >
                      <p className="mb-2 font-medium">{doc!.title}</p>
                      {doc!.body_md}
                    </div>
                  ))}
                  <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <Checkbox
                      data-testid="onb-accept-privacy"
                      checked={acceptPrivacy}
                      onChange={(e) => setAcceptPrivacy(e.target.checked)}
                    />
                    <span>Acepto la política de privacidad</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <Checkbox
                      data-testid="onb-accept-terms"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                    />
                    <span>Acepto los términos de uso</span>
                  </label>
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className={buttonIconClassName} />
                  <ButtonLabel>Atrás</ButtonLabel>
                </Button>
                <Button
                  type="button"
                  data-testid="onb-accept-legal"
                  disabled={
                    legalMutation.isPending ||
                    !acceptPrivacy ||
                    !acceptTerms ||
                    !privacyDoc ||
                    !termsDoc
                  }
                  onClick={() => {
                    setError(null);
                    legalMutation.mutate();
                  }}
                >
                  {legalMutation.isPending ? <Spinner className={buttonIconClassName} /> : null}
                  <ButtonLabel>
                    {legalMutation.isPending ? "Guardando…" : "Aceptar y continuar"}
                  </ButtonLabel>
                </Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-success-500/10 text-success-600">
                <Check className="size-6" />
              </div>
              <CardTitle>Listo</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Onboarding completo. Ya puedes usar el panel de tu organización.
              </p>
              <Button
                type="button"
                data-testid="onb-goto-app"
                onClick={() => {
                  void qc.invalidateQueries({
                    queryKey: ["onboarding-status"],
                  });
                  navigate("/app", { replace: true });
                }}
              >
                <ButtonLabel>Ir al panel</ButtonLabel>
                <ArrowRight className={buttonIconClassName} />
              </Button>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
