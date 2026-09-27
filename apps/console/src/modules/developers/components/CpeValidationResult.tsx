import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  XCircle,
} from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Card, CardTitle } from "@/shared/ui/components/card";
import { MutedText } from "@/shared/ui/components/muted-text";
import { cn } from "@/shared/ui/utils";

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
  const warn = result.cpe_status === "2";
  const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : XCircle;

  return (
    <Card>
      <CardTitle className="flex flex-wrap items-center gap-2">
        Resultado
        <Badge
          variant={ok ? "success" : warn ? "warning" : "error"}
          className="gap-1"
        >
          <Icon className="size-3.5" aria-hidden />
          {result.cpe_status_label} ({result.cpe_status})
        </Badge>
        {result.cached ? <Badge variant="muted">cached</Badge> : null}
      </CardTitle>
      <div
        className={cn(
          "mb-4 flex items-start gap-3 rounded-xl px-4 py-3",
          ok && "bg-success-50 dark:bg-success-500/10",
          warn && "bg-warning-50 dark:bg-warning-500/10",
          !ok && !warn && "bg-error-50 dark:bg-error-500/10",
        )}
      >
        <Icon
          className={cn(
            "mt-0.5 size-5 shrink-0",
            ok && "text-success-600 dark:text-success-400",
            warn && "text-warning-600 dark:text-warning-400",
            !ok && !warn && "text-error-600 dark:text-error-400",
          )}
          aria-hidden
        />
        <p className="text-sm text-gray-800 dark:text-white/90">
          {result.cpe_status_label}
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <MutedText as="dt">Estado RUC</MutedText>
          <dd className="text-theme-sm text-gray-800 dark:text-white/90">
            {result.ruc_status_label} ({result.ruc_status})
          </dd>
        </div>
        <div>
          <MutedText as="dt" className="flex items-center gap-1">
            <Clock3 className="size-3" aria-hidden />
            Consultado
          </MutedText>
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
    </Card>
  );
}
