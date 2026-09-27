import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Truck, X } from "lucide-react";
import { useOutletContext, useParams } from "react-router-dom";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import { Badge } from "@/shared/ui/components/badge";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import { Card, CardTitle } from "@/shared/ui/components/card";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { MutedText } from "@/shared/ui/components/muted-text";
import { ErrorState } from "@/shared/ui/ErrorState";
import { toast } from "@/shared/ui/toaster";
import { cn } from "@/shared/ui/utils";

import { putGreCredentials } from "../../api";
import type { Company } from "../../types";

export function GreTab() {
  const { id } = useParams<{ id: string }>();
  const { company } = useOutletContext<{ company: Company }>();
  const { hasPermission } = useSession();
  const canManage = hasPermission("credentials:manage");
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  const summary = company.credentials_summary?.gre;

  const mutation = useMutation({
    mutationFn: () =>
      putGreCredentials(id ?? "", {
        client_id: clientId,
        client_secret: clientSecret,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["company", id] });
      await qc.invalidateQueries({ queryKey: ["companies"] });
      setClientSecret("");
      setError(null);
      setOpen(false);
      toast.success("Credenciales GRE guardadas");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Error GRE");
    },
  });

  function handleClose() {
    if (mutation.isPending) return;
    setOpen(false);
    setError(null);
    setClientSecret("");
  }

  function handleOpen() {
    setClientId(summary?.client_id ?? "");
    setClientSecret("");
    setError(null);
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-xl",
                company.gre_configured
                  ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500"
                  : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
              )}
            >
              <Truck className="size-5" />
            </span>
            <div>
              <CardTitle className="mb-1">Guía de remisión (GRE)</CardTitle>
              <Badge variant={company.gre_configured ? "success" : "muted"}>
                {company.gre_configured ? "Configurado" : "Sin configurar"}
              </Badge>
            </div>
          </div>
          {canManage ? (
            <Button
              type="button"
              size="icon-label-sm"
              aria-label="Configurar GRE"
              onClick={handleOpen}
            >
              <Save className={buttonIconClassName} />
              <ButtonLabel>
                {company.gre_configured ? "Actualizar GRE" : "Configurar GRE"}
              </ButtonLabel>
            </Button>
          ) : null}
        </div>

        {summary ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <Row label="Client ID" value={summary.client_id ?? "—"} />
            <Row label="Rotated" value={summary.rotated_at ?? "—"} />
          </dl>
        ) : (
          <MutedText>
            Credenciales OAuth de la API GRE / SUNAT para guías electrónicas.
          </MutedText>
        )}

        {!canManage ? (
          <MutedText className="mt-4">
            Requiere credentials:manage.
          </MutedText>
        ) : null}
      </Card>

      <Dialog
        open={open}
        onClose={handleClose}
        ariaLabel="Configurar credenciales GRE"
        size="sm"
        closeOnBackdrop={!mutation.isPending}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            mutation.mutate();
          }}
        >
          <DialogHeader
            title="Configurar GRE"
            description="Client ID y secret de la API GRE. El secret es write-only."
            onClose={handleClose}
          />
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gre-id">Client ID</Label>
              <Input
                id="gre-id"
                required
                autoComplete="off"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gre-secret">Client secret (write-only)</Label>
              <Input
                id="gre-secret"
                type="password"
                required
                autoComplete="new-password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </div>
            {error ? <ErrorState title="Error" message={error} /> : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="icon-label-sm"
              aria-label="Cancelar"
              disabled={mutation.isPending}
              onClick={handleClose}
            >
              <X className={buttonIconClassName} />
              <ButtonLabel>Cancelar</ButtonLabel>
            </Button>
            <Button
              type="submit"
              size="icon-label-sm"
              aria-label="Guardar GRE"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <Loader2 className={cn(buttonIconClassName, "animate-spin")} />
              ) : (
                <Save className={buttonIconClassName} />
              )}
              <ButtonLabel>
                {mutation.isPending ? "Guardando…" : "Guardar"}
              </ButtonLabel>
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <MutedText as="dt" className="text-xs uppercase tracking-wide">
        {label}
      </MutedText>
      <dd className="mt-0.5 font-mono text-xs text-gray-800 dark:text-white/90">
        {value}
      </dd>
    </div>
  );
}
