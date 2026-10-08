import { Spinner } from "@factosys/ui";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Scale } from "lucide-react";
import { toast } from "sonner";

import {
  acceptOnboardingLegal,
  fetchOnboardingLegal,
  fetchOnboardingStatus,
} from "@/modules/app/api/onboarding";
import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
  Checkbox,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  ErrorState,
  FieldError,
  LoadingState,
} from "@factosys/ui";

/** Blocking modal when published legal docs bump and org must re-accept (S16-LEG). */
export function LegalReacceptModal() {
  const { user, isPlatform } = useSession();
  const qc = useQueryClient();
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["onboarding-status", user?.organizationId],
    queryFn: fetchOnboardingStatus,
    enabled: Boolean(user) && !isPlatform,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const needsReaccept = Boolean(statusQuery.data?.requires_reaccept);
  const open = needsReaccept;

  const legalQuery = useQuery({
    queryKey: ["onboarding-legal"],
    queryFn: fetchOnboardingLegal,
    enabled: open,
  });

  const privacyDoc = useMemo(
    () => legalQuery.data?.items.find((d) => d.code === "privacy.es-PE"),
    [legalQuery.data],
  );
  const termsDoc = useMemo(
    () => legalQuery.data?.items.find((d) => d.code === "terms.es-PE"),
    [legalQuery.data],
  );

  const acceptMutation = useMutation({
    mutationFn: () => {
      if (!privacyDoc || !termsDoc) {
        throw new Error("Documentos legales no disponibles");
      }
      return acceptOnboardingLegal([privacyDoc.id, termsDoc.id]);
    },
    onSuccess: async () => {
      toast.success("Términos actualizados aceptados");
      setError(null);
      setAcceptPrivacy(false);
      setAcceptTerms(false);
      await qc.invalidateQueries({ queryKey: ["onboarding-status"] });
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

  if (isPlatform || !user) return null;

  return (
    <Dialog
      open={open}
      onClose={() => {
        /* blocking: cannot dismiss without accept */
      }}
      ariaLabel="Reaceptar términos legales"
      size="lg"
      closeOnBackdrop={false}
    >
      <DialogHeader
        title="Actualización de términos"
        description="Publicamos una nueva versión de los documentos legales. Debes aceptarlos para continuar usando el panel."
      />
      <DialogBody>
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
          <Scale className="size-6" />
        </div>
        {legalQuery.isLoading ? (
          <LoadingState variant="documents" label="Cargando documentos…" />
        ) : legalQuery.error ? (
          <ErrorState
            message="No se pudieron cargar los documentos"
            onRetry={() => void legalQuery.refetch()}
          />
        ) : (
          <div className="space-y-4">
            {[privacyDoc, termsDoc].filter(Boolean).map((doc) => (
              <div
                key={doc!.id}
                className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm whitespace-pre-wrap text-gray-700 dark:border-gray-700 dark:bg-white/5 dark:text-gray-200"
              >
                <p className="mb-1 font-medium">
                  {doc!.title}{" "}
                  <span className="text-theme-xs font-normal text-gray-500">v{doc!.version}</span>
                </p>
                {doc!.body_md}
              </div>
            ))}
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
              <Checkbox
                data-testid="legal-reaccept-privacy"
                checked={acceptPrivacy}
                onChange={(e) => setAcceptPrivacy(e.target.checked)}
              />
              <span>Acepto la política de privacidad actualizada</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
              <Checkbox
                data-testid="legal-reaccept-terms"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
              />
              <span>Acepto los términos de uso actualizados</span>
            </label>
            {error ? <FieldError message={error} /> : null}
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button
          type="button"
          data-testid="legal-reaccept-submit"
          disabled={
            acceptMutation.isPending || !acceptPrivacy || !acceptTerms || !privacyDoc || !termsDoc
          }
          onClick={() => {
            setError(null);
            acceptMutation.mutate();
          }}
        >
          {acceptMutation.isPending ? <Spinner className={buttonIconClassName} /> : null}
          <ButtonLabel>
            {acceptMutation.isPending ? "Guardando…" : "Aceptar y continuar"}
          </ButtonLabel>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
