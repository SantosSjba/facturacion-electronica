import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";

import { validateCpe } from "../api";
import { CpeValidationForm } from "../components/CpeValidationForm";
import { CpeValidationResultPanel } from "../components/CpeValidationResult";
import type { CpeValidationResult } from "../types";

export function ValidationsPage() {
  const { hasPermission } = useSession();
  const canValidate = hasPermission("validations:cpe");
  const [result, setResult] = useState<CpeValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: validateCpe,
    onSuccess: (data) => {
      setResult(data);
      setError(null);
    },
    onError: (err) => {
      setResult(null);
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo consultar CPE",
      );
    },
  });

  return (
    <div>
      <PageHeader
        title="Validez CPE"
        description="Consulta de validez de comprobantes (Fake/SUNAT + cache)."
      />

      {!canValidate ? (
        <ErrorState message="No tienes permiso validations:cpe." />
      ) : (
        <div className="space-y-6">
          <CpeValidationForm
            submitting={mutation.isPending}
            onSubmit={(input) => mutation.mutate(input)}
          />
          {error ? <ErrorState message={error} /> : null}
          {result ? <CpeValidationResultPanel result={result} /> : null}
        </div>
      )}
    </div>
  );
}
