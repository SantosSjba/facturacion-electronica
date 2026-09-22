import { Badge } from "@/shared/ui/components/badge";
import { MutedText } from "@/shared/ui/components/muted-text";

import type { CpeValidationResult } from "../types";

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function CpeValidationResultPanel({
  result,
}: {
  result: CpeValidationResult;
}) {
  const ok = result.cpe_status === "1";
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
          Resultado
        </h3>
        <Badge variant={ok ? "success" : result.cpe_status === "2" ? "warning" : "error"}>
          {result.cpe_status_label} ({result.cpe_status})
        </Badge>
        {result.cached ? <Badge variant="muted">cached</Badge> : null}
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <MutedText as="dt">Estado RUC</MutedText>
          <dd className="text-theme-sm text-gray-800 dark:text-white/90">
            {result.ruc_status_label} ({result.ruc_status})
          </dd>
        </div>
        <div>
          <MutedText as="dt">Consultado</MutedText>
          <dd className="text-theme-sm text-gray-800 dark:text-white/90">
            {formatDate(result.checked_at)}
          </dd>
        </div>
        {result.observations ? (
          <div className="sm:col-span-2">
            <MutedText as="dt">Observaciones</MutedText>
            <dd className="text-theme-sm">{result.observations}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
