import { createContext, useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Send,
} from "lucide-react";

import {
  Button,
  ButtonLabel,
  buttonIconClassName,
  buttonVariants,
} from "@/shared/ui/components/button";
import { Card } from "@/shared/ui/components/card";
import { MutedText } from "@/shared/ui/components/muted-text";
import { cn } from "@/shared/ui/utils";

const WizardAttemptedContext = createContext(false);

/** True after the user tries Next/Emit while the current step is invalid. */
export function useWizardAttempted() {
  return useContext(WizardAttemptedContext);
}

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
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    setAttempted(false);
  }, [step]);

  function handleNext() {
    if (nextError) {
      setAttempted(true);
      return;
    }
    onNext();
  }

  function handleSubmit() {
    if (nextError) {
      setAttempted(true);
      return;
    }
    onSubmit();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
            {title}
          </h1>
          {description ? (
            <MutedText className="mt-1">{description}</MutedText>
          ) : null}
        </div>
        <Link
          to="/documents"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon-label-sm" }),
          )}
          aria-label="Volver a comprobantes"
        >
          <ArrowLeft className={buttonIconClassName} />
          <ButtonLabel>Comprobantes</ButtonLabel>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Pasos del wizard" className="lg:sticky lg:top-4 lg:self-start">
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {steps.map((label, i) => {
              const active = i === step;
              const done = i < step;
              return (
                <li key={label}>
                  <div
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                      active &&
                        "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300",
                      done &&
                        !active &&
                        "border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400",
                      !active &&
                        !done &&
                        "border-gray-200 bg-white text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-theme-xs font-semibold",
                        active && "bg-brand-500 text-white",
                        done && !active && "bg-success-500 text-white",
                        !active &&
                          !done &&
                          "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400",
                      )}
                    >
                      {done ? <Check className="size-3.5" /> : i + 1}
                    </span>
                    <span className="min-w-0 truncate font-medium">{label}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="min-w-0 space-y-4">
          <WizardAttemptedContext.Provider value={attempted}>
            <Card className="min-h-64 overflow-x-auto">{children}</Card>
          </WizardAttemptedContext.Provider>

          {attempted && nextError ? (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400"
            >
              <AlertCircle className="size-4 shrink-0" />
              {nextError}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-white/[0.03]">
            <Button
              type="button"
              variant="outline"
              size="icon-label"
              aria-label="Atrás"
              onClick={onBack}
              disabled={step === 0 || submitting}
            >
              <ArrowLeft className={buttonIconClassName} />
              <ButtonLabel>Atrás</ButtonLabel>
            </Button>
            {isLast ? (
              <Button
                type="button"
                size="icon-label"
                aria-label={submitting ? "Emitiendo…" : "Emitir"}
                data-testid="wizard-submit"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2
                    className={cn(buttonIconClassName, "animate-spin")}
                  />
                ) : (
                  <Send className={buttonIconClassName} />
                )}
                <ButtonLabel>
                  {submitting ? "Emitiendo…" : "Emitir"}
                </ButtonLabel>
              </Button>
            ) : (
              <Button
                type="button"
                size="icon-label"
                aria-label="Siguiente"
                data-testid="wizard-next"
                onClick={handleNext}
                disabled={submitting}
              >
                <ArrowRight className={buttonIconClassName} />
                <ButtonLabel>Siguiente</ButtonLabel>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
