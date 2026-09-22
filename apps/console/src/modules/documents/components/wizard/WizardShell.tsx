import { Button } from "@/shared/ui/components/button";

export function WizardShell({
  title,
  description,
  step,
  steps,
  onBack,
  onNext,
  onSubmit,
  submitting,
  nextDisabled,
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
  nextDisabled?: boolean;
  children: React.ReactNode;
}) {
  const isLast = step >= steps.length - 1;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {description}
          </p>
        ) : null}
      </div>

      <ol className="flex flex-wrap gap-2">
        {steps.map((label, i) => (
          <li
            key={label}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              i === step
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : i < step
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)]"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
        {children}
      </div>

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
            disabled={nextDisabled || submitting}
          >
            Siguiente
          </Button>
        )}
      </div>
    </div>
  );
}
