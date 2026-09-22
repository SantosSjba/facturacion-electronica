import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Plus, X } from "lucide-react";

import { ApiError } from "@/shared/api/errors";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import { Checkbox } from "@/shared/ui/components/checkbox";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { ErrorState } from "@/shared/ui/ErrorState";
import { FieldError } from "@/shared/ui/FieldError";
import { cn } from "@/shared/ui/utils";

import { createWebhook } from "../api";

const WEBHOOK_EVENTS = ["document.status_changed"] as const;

export function CreateWebhookDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["document.status_changed"]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ url?: string; events?: string }>(
    {},
  );
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: createWebhook,
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["webhooks"] });
      setSecret(result.secret);
      setError(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError("No se pudo crear el webhook");
    },
  });

  function resetAndClose() {
    setUrl("");
    setEvents(["document.status_changed"]);
    setError(null);
    setFieldErrors({});
    setSecret(null);
    setCopied(false);
    onClose();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const next: typeof fieldErrors = {};
    if (!url.startsWith("https://")) next.url = "La URL debe ser https://";
    if (events.length < 1) next.events = "Selecciona al menos un evento";
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;
    mutation.mutate({ url: url.trim(), events });
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={resetAndClose}
      ariaLabel="Crear webhook"
      closeOnBackdrop={!secret}
    >
      {secret ? (
        <>
          <DialogHeader
            title="Webhook creado"
            description="Copia el secreto ahora. No se volverá a mostrar (usa rotar)."
            onClose={resetAndClose}
          />
          <DialogBody className="space-y-3">
            <div className="space-y-1.5">
              <Label>Secret</Label>
              <div className="flex gap-2">
                <Input readOnly value={secret} className="font-mono text-theme-xs" />
                <Button type="button" variant="outline" onClick={() => void copySecret()}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              size="icon-label-sm"
              aria-label="Entendido"
              onClick={resetAndClose}
            >
              <Check className={buttonIconClassName} />
              <ButtonLabel>Entendido</ButtonLabel>
            </Button>
          </DialogFooter>
        </>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)}>
          <DialogHeader
            title="Nuevo webhook"
            description="Endpoint HTTPS para eventos de documento."
            onClose={resetAndClose}
          />
          <DialogBody className="space-y-4">
            {error ? <ErrorState message={error} /> : null}
            <div className="space-y-1.5">
              <Label htmlFor="wh-url">URL (https)</Label>
              <Input
                id="wh-url"
                type="url"
                placeholder="https://example.com/hooks"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                aria-invalid={Boolean(fieldErrors.url)}
              />
              <FieldError message={fieldErrors.url} />
            </div>
            <fieldset className="space-y-2">
              <Label>Eventos</Label>
              <div className="space-y-2 rounded-md border border-gray-200 p-3 dark:border-gray-800">
                {WEBHOOK_EVENTS.map((ev) => (
                  <label key={ev} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={events.includes(ev)}
                      onChange={() =>
                        setEvents((prev) =>
                          prev.includes(ev)
                            ? prev.filter((x) => x !== ev)
                            : [...prev, ev],
                        )
                      }
                    />
                    <span className="font-mono text-theme-xs">{ev}</span>
                  </label>
                ))}
              </div>
              <FieldError message={fieldErrors.events} />
            </fieldset>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="icon-label-sm"
              aria-label="Cancelar"
              onClick={resetAndClose}
            >
              <X className={buttonIconClassName} />
              <ButtonLabel>Cancelar</ButtonLabel>
            </Button>
            <Button
              type="submit"
              size="icon-label-sm"
              aria-label="Crear"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <Loader2 className={cn(buttonIconClassName, "animate-spin")} />
              ) : (
                <Plus className={buttonIconClassName} />
              )}
              <ButtonLabel>
                {mutation.isPending ? "Creando…" : "Crear"}
              </ButtonLabel>
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
