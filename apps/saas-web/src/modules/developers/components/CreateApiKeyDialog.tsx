import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Plus, X } from "lucide-react";

import { ApiError } from "@/shared/api/errors";
import { Button, ButtonLabel, buttonIconClassName } from "@/shared/ui/components/button";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";
import { ErrorState } from "@/shared/ui/ErrorState";
import { FieldError } from "@/shared/ui/FieldError";
import { cn } from "@/shared/ui/utils";

import { createApiKey } from "../api";
import { MACHINE_SCOPES, type CreateApiKeyResult } from "../types";
import { apiKeyFormSchema, zodFieldErrors } from "../validation";

export function CreateApiKeyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["documents:read"]);
  const [env, setEnv] = useState<"" | "sandbox" | "production">("");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [created, setCreated] = useState<CreateApiKeyResult | null>(null);
  const [copied, setCopied] = useState(false);

  const fieldErrors = zodFieldErrors(apiKeyFormSchema.safeParse({ name, scopes }));

  const mutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["api-keys"] });
      setCreated(result);
      setError(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError("No se pudo crear la API key");
    },
  });

  function resetAndClose() {
    setName("");
    setScopes(["documents:read"]);
    setEnv("");
    setError(null);
    setTouched(false);
    setCreated(null);
    setCopied(false);
    onClose();
  }

  function toggleScope(scope: string) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTouched(true);
    if (Object.keys(fieldErrors).length > 0) return;
    mutation.mutate({
      name: name.trim(),
      scopes,
      environment_constraint: env === "" ? null : env,
    });
  }

  async function copySecret() {
    if (!created?.secret) return;
    try {
      await navigator.clipboard.writeText(created.secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={resetAndClose}
      ariaLabel="Crear API key"
      size="md"
      closeOnBackdrop={!created}
    >
      {created ? (
        <>
          <DialogHeader
            title="API key creada"
            description="Copia el secreto ahora. No se volverá a mostrar."
            onClose={resetAndClose}
          />
          <DialogBody className="space-y-3">
            <div className="space-y-1.5">
              <Label>Secret</Label>
              <div className="flex gap-2">
                <Input readOnly value={created.secret} className="font-mono text-theme-xs" />
                <Button type="button" variant="outline" onClick={() => void copySecret()}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-theme-sm text-warning-600 dark:text-orange-400">
              Guárdalo en un gestor de secretos. Al cerrar no podrás recuperarlo.
            </p>
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
            title="Nueva API key"
            description="Clave máquina para integraciones."
            onClose={resetAndClose}
          />
          <DialogBody className="space-y-4">
            {error ? <ErrorState message={error} /> : null}
            <div className="space-y-1.5">
              <Label htmlFor="apikey-name">Nombre</Label>
              <Input
                id="apikey-name"
                value={name}
                onChange={(e) => {
                  setTouched(true);
                  setName(e.target.value);
                }}
                aria-invalid={touched && Boolean(fieldErrors.name)}
              />
              <FieldError message={touched ? fieldErrors.name : undefined} />
            </div>
            <fieldset className="space-y-2">
              <Label>Scopes</Label>
              <div className="grid gap-2 rounded-md border border-gray-200 p-3 sm:grid-cols-2 dark:border-gray-800">
                {MACHINE_SCOPES.map((scope) => (
                  <label key={scope} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={scopes.includes(scope)}
                      onChange={() => {
                        setTouched(true);
                        toggleScope(scope);
                      }}
                    />
                    <span className="font-mono text-theme-xs">{scope}</span>
                  </label>
                ))}
              </div>
              <FieldError message={touched ? fieldErrors.scopes : undefined} />
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="apikey-env">Entorno (opcional)</Label>
              <Select
                id="apikey-env"
                value={env}
                onChange={(e) => setEnv(e.target.value as "" | "sandbox" | "production")}
              >
                <option value="">Sin restricción</option>
                <option value="sandbox">sandbox</option>
                <option value="production">production</option>
              </Select>
            </div>
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
              <ButtonLabel>{mutation.isPending ? "Creando…" : "Crear"}</ButtonLabel>
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
