import { Spinner } from "@factosys/ui";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus, X } from "lucide-react";

import { ApiError } from "@/shared/api/errors";
import { environmentLabel } from "@/shared/ui/display-labels";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
  Checkbox,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Input,
  Label,
  Select,
  ErrorState,
  FieldError,
} from "@factosys/ui";

import { createWebhook, fetchWebhookCompanies } from "../api";
import { createWebhookFormSchema, zodFieldErrors } from "../validation";

export const WEBHOOK_EVENTS = ["document.status_changed"] as const;

export function CreateWebhookDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [scope, setScope] = useState<"company" | "global">("company");
  const [companyId, setCompanyId] = useState("");
  const companies = useQuery({
    queryKey: ["webhook-companies"],
    queryFn: fetchWebhookCompanies,
    enabled: open,
  });
  const [events, setEvents] = useState<string[]>(["document.status_changed"]);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fieldErrors = zodFieldErrors(
    createWebhookFormSchema.safeParse({ url, events, scope, companyId }),
  );

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
    setScope("company");
    setCompanyId("");
    setEvents(["document.status_changed"]);
    setError(null);
    setTouched(false);
    setSecret(null);
    setCopied(false);
    onClose();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTouched(true);
    if (Object.keys(fieldErrors).length > 0) return;
    if (mutation.isPending || (scope === "company" && (companies.isPending || companies.isError)))
      return;
    mutation.mutate({ url: url.trim(), events, company_id: scope === "global" ? null : companyId });
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
    <Dialog open={open} onClose={resetAndClose} ariaLabel="Crear webhook" closeOnBackdrop={!secret}>
      {secret ? (
        <>
          <DialogHeader
            title="Webhook creado"
            description="Copia el secreto ahora. No se volverá a mostrar (usa rotar)."
            onClose={resetAndClose}
          />
          <DialogBody className="space-y-3">
            <p className="text-sm">
              {scope === "global"
                ? "Alcance: todas las empresas de la organización"
                : `Empresa: ${companies.data?.find((company) => company.id === companyId)?.legal_name ?? companyId}`}
            </p>
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
              <Label htmlFor="wh-scope">Alcance del webhook</Label>
              <Select
                id="wh-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as "company" | "global")}
              >
                <option value="company">Una empresa</option>
                <option value="global">Todas las empresas (global)</option>
              </Select>
            </div>
            {scope === "company" ? (
              <div className="space-y-1.5">
                <Label htmlFor="wh-company">Empresa</Label>
                <Select
                  id="wh-company"
                  value={companyId}
                  disabled={companies.isPending || companies.isError}
                  aria-invalid={touched && Boolean(fieldErrors.companyId)}
                  onChange={(e) => setCompanyId(e.target.value)}
                >
                  <option value="">Selecciona la empresa</option>
                  {companies.data?.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.legal_name} · {company.ruc} · {environmentLabel(company.environment)}
                    </option>
                  ))}
                </Select>
                {companies.isPending ? <p className="text-sm">Cargando empresas…</p> : null}
                {companies.isError ? (
                  <ErrorState
                    message="No se pudieron cargar las empresas"
                    onRetry={() => void companies.refetch()}
                  />
                ) : null}
                {companies.data?.length === 0 ? (
                  <p className="text-sm">Primero registra una empresa para crear su webhook.</p>
                ) : null}
                <FieldError message={touched ? fieldErrors.companyId : undefined} />
                <p className="text-sm text-gray-500">
                  Solo recibirá eventos de documentos de esta empresa.
                </p>
              </div>
            ) : (
              <p className="text-sm text-warning-600 dark:text-orange-400">
                Recibirá eventos de todas las empresas de esta organización, incluidas las que
                registres después.
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="wh-url">URL (https)</Label>
              <Input
                id="wh-url"
                type="url"
                placeholder="https://example.com/hooks"
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
              onClick={resetAndClose}
            >
              <X className={buttonIconClassName} />
              <ButtonLabel>Cancelar</ButtonLabel>
            </Button>
            <Button
              type="submit"
              size="icon-label-sm"
              aria-label="Crear"
              disabled={
                mutation.isPending ||
                (scope === "company" && (companies.isPending || companies.isError))
              }
            >
              {mutation.isPending ? (
                <Spinner className={buttonIconClassName} />
              ) : (
                <Plus className={buttonIconClassName} />
              )}
              <ButtonLabel>{mutation.isPending ? "Creando…" : "Crear"}</ButtonLabel>
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
