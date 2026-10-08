import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Save, X } from "lucide-react";
import { useOutletContext, useParams } from "react-router-dom";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import { Badge } from "@/shared/ui/components/badge";
import { Button, ButtonLabel, buttonIconClassName } from "@/shared/ui/components/button";
import { Card, CardTitle } from "@/shared/ui/components/card";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { MutedText } from "@/shared/ui/components/muted-text";
import { ErrorState } from "@/shared/ui/ErrorState";
import { toast } from "@/shared/ui/toaster";
import { cn } from "@/shared/ui/utils";

import { putSolCredentials } from "../../api";
import type { Company } from "../../types";

export function SolTab() {
  const { id } = useParams<{ id: string }>();
  const { company } = useOutletContext<{ company: Company }>();
  const { hasPermission } = useSession();
  const canManage = hasPermission("credentials:manage");
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const summary = company.credentials_summary?.sol;

  const mutation = useMutation({
    mutationFn: () => putSolCredentials(id ?? "", { username, password }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["company", id] });
      await qc.invalidateQueries({ queryKey: ["companies"] });
      setPassword("");
      setError(null);
      setOpen(false);
      toast.success("Credenciales SOL guardadas");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Error SOL");
    },
  });

  function handleClose() {
    if (mutation.isPending) return;
    setOpen(false);
    setError(null);
    setPassword("");
  }

  function handleOpen() {
    setUsername(summary?.username ?? "");
    setPassword("");
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
                company.sol_configured
                  ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500"
                  : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
              )}
            >
              <KeyRound className="size-5" />
            </span>
            <div>
              <CardTitle className="mb-1">Clave SOL</CardTitle>
              <Badge variant={company.sol_configured ? "success" : "muted"}>
                {company.sol_configured ? "Configurado" : "Sin configurar"}
              </Badge>
            </div>
          </div>
          {canManage ? (
            <Button
              type="button"
              size="icon-label-sm"
              aria-label="Configurar SOL"
              onClick={handleOpen}
            >
              <Save className={buttonIconClassName} />
              <ButtonLabel>
                {company.sol_configured ? "Actualizar SOL" : "Configurar SOL"}
              </ButtonLabel>
            </Button>
          ) : null}
        </div>

        {summary ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <Row label="Usuario" value={summary.username ?? "—"} />
            <Row label="Rotated" value={summary.rotated_at ?? "—"} />
          </dl>
        ) : (
          <MutedText>Credenciales del usuario secundario SUNAT (SOL) para envío de CPE.</MutedText>
        )}

        {!canManage ? <MutedText className="mt-4">Requiere credentials:manage.</MutedText> : null}
      </Card>

      <Dialog
        open={open}
        onClose={handleClose}
        ariaLabel="Configurar clave SOL"
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
            title="Configurar clave SOL"
            description="Usuario y contraseña secundarios SUNAT. La contraseña es write-only."
            onClose={handleClose}
          />
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sol-user">Usuario SOL</Label>
              <Input
                id="sol-user"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sol-pass">Password (write-only)</Label>
              <Input
                id="sol-pass"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              aria-label="Guardar SOL"
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
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <MutedText as="dt" className="text-xs uppercase tracking-wide">
        {label}
      </MutedText>
      <dd className="mt-0.5 font-mono text-xs text-gray-800 dark:text-white/90">{value}</dd>
    </div>
  );
}
