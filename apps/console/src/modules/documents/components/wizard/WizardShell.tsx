import { Button } from "@/shared/ui/components/button";
import { MutedText } from "@/shared/ui/components/muted-text";
import { AlertCircle, Check } from "lucide-react";

export function WizardShell({
  title,
  description,
  step,
  steps,
  onBack,
  onNext,
  onSubmit,
  submitting,
  nextError,
  children,
}: {
  title: string;
  description?: string;
  step: number;
  steps: string[];
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  submitting?: boolean;
  nextError?: string | null;
  children: React.ReactNode;
}) {
  const isLast = step >= steps.length - 1;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <MutedText className="mt-1">{description}</MutedText>
        ) : null}
      </div>

      <ol className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {steps.map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ${
              i === step
                ? "bg-brand-500 text-white"
                : i < step
                  ? "bg-brand-50 text-brand-500 dark:bg-brand-500/[0.12] dark:text-brand-400"
                  : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400"
            }`}
          >
            {i < step ? <Check className="size-3.5" /> : <span>{i + 1}.</span>} {label}
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        {children}
      </div>

      {!isLast && nextError ? (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
          <AlertCircle className="size-4 shrink-0" />
          {nextError}
        </div>
      ) : null}

      <div className="flex justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={step === 0 || submitting}
        >
          Atrás
        </Button>
        {isLast ? (
          <Button type="button" onClick={onSubmit} disabled={submitting}>
            {submitting ? "Emitiendo…" : "Emitir"}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onNext}
            disabled={Boolean(nextError) || submitting}
          >
            Siguiente
          </Button>
        )}
      </div>
    </div>
  );
}
