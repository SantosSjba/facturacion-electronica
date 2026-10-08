import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, X } from "lucide-react";

import { ApiError } from "@/shared/api/errors";
import { Button, ButtonLabel, buttonIconClassName } from "@/shared/ui/components/button";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { ErrorState } from "@/shared/ui/ErrorState";
import { FieldError } from "@/shared/ui/FieldError";
import { cn } from "@/shared/ui/utils";

import { patchWebhook } from "../api";
import type { WebhookEndpoint } from "../types";
import { webhookFormSchema, zodFieldErrors } from "../validation";
import { WEBHOOK_EVENTS } from "./CreateWebhookDialog";

export function EditWebhookDialog({
  endpoint,
  onClose,
}: {
  endpoint: WebhookEndpoint | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!endpoint) return;
    setUrl(endpoint.url);
    setEvents([...endpoint.events]);
    setTouched(false);
    setError(null);
  }, [endpoint]);

  const fieldErrors = zodFieldErrors(webhookFormSchema.safeParse({ url, events }));

  const mutation = useMutation({
    mutationFn: () => {
      if (!endpoint) throw new Error("Selecciona un webhook para editar");
      return patchWebhook(endpoint.id, { url: url.trim(), events });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["webhooks"] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError("No se pudo actualizar");
    },
  });

  return (
    <Dialog open={Boolean(endpoint)} onClose={onClose} ariaLabel="Editar webhook" size="md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          setError(null);
          if (Object.keys(fieldErrors).length > 0) return;
          mutation.mutate();
        }}
      >
        <DialogHeader
          title="Editar webhook"
          description="Actualiza URL y eventos suscritos."
          onClose={onClose}
        />
        <DialogBody className="space-y-4">
          {error ? <ErrorState message={error} /> : null}
          <div className="space-y-1.5">
            <Label htmlFor="edit-wh-url">URL (https)</Label>
            <Input
              id="edit-wh-url"
              type="url"
              value={url}
              onChange={(e) => {
                setTouched(true);
                setUrl(e.target.value);
              }}
              aria-invalid={touched && Boolean(fieldErrors.url)}
            />
            <FieldError message={touched ? fieldErrors.url : undefined} />
          </div>
          <fieldset className="space-y-2">
            <Label>Eventos</Label>
            <div className="space-y-2 rounded-md border border-gray-200 p-3 dark:border-gray-800">
              {WEBHOOK_EVENTS.map((ev) => (
                <label key={ev} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={events.includes(ev)}
                    onChange={() => {
                      setTouched(true);
                      setEvents((prev) =>
                        prev.includes(ev) ? prev.filter((x) => x !== ev) : [...prev, ev],
                      );
                    }}
                  />
                  <span className="font-mono text-theme-xs">{ev}</span>
                </label>
              ))}
            </div>
            <FieldError message={touched ? fieldErrors.events : undefined} />
          </fieldset>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="icon-label-sm"
            aria-label="Cancelar"
            onClick={onClose}
          >
            <X className={buttonIconClassName} />
            <ButtonLabel>Cancelar</ButtonLabel>
          </Button>
          <Button
            type="submit"
            size="icon-label-sm"
            aria-label="Guardar"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className={cn(buttonIconClassName, "animate-spin")} />
            ) : (
              <Save className={buttonIconClassName} />
            )}
            <ButtonLabel>{mutation.isPending ? "Guardando…" : "Guardar"}</ButtonLabel>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
