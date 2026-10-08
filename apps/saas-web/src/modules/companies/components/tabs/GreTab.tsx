import { Spinner } from "@factosys/ui";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Fingerprint, Lock, Save, Settings2, Truck, X } from "lucide-react";
import { useOutletContext, useParams } from "react-router-dom";

import { ApiError } from "@/shared/api/errors";
import { formatDateTime } from "@/shared/ui/display-labels";
import { StatusBadge } from "@/shared/ui/status-badge";
import { useSession } from "@/shared/auth/session-context";
import {
  ActionButton,
  Button,
  ButtonLabel,
  buttonIconClassName,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Input,
  Label,
  InfoField,
  InfoGrid,
  MutedText,
  ErrorState,
  SectionCard,
} from "@factosys/ui";

import { toast } from "@/shared/ui/toaster";

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
      <SectionCard
        icon={Truck}
        tone={company.gre_configured ? "success" : "muted"}
        title="Guía de remisión (GRE)"
        description={
          <StatusBadge
            status={company.gre_configured ? "active" : "disabled"}
            label={company.gre_configured ? "Configurado" : "Sin configurar"}
          />
        }
        actions={
          canManage ? (
            <ActionButton
              variant="primary"
              icon={Settings2}
              label={company.gre_configured ? "Actualizar GRE" : "Configurar GRE"}
              onClick={handleOpen}
            />
          ) : null
        }
      >
        {summary ? (
          <InfoGrid>
            <InfoField
              icon={Fingerprint}
              label="Identificador de cliente"
              value={summary.client_id}
              mono
            />
            <InfoField
              icon={CalendarClock}
              label="Última actualización"
              value={formatDateTime(summary.rotated_at)}
            />
          </InfoGrid>
        ) : (
          <MutedText>Credenciales OAuth de la API GRE / SUNAT para guías electrónicas.</MutedText>
        )}

        {!canManage ? (
          <MutedText className="mt-4 flex items-center gap-1.5">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            Necesitas permiso para administrar credenciales.
          </MutedText>
        ) : null}
      </SectionCard>

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
              <Label htmlFor="gre-id">Identificador de cliente</Label>
              <Input
                id="gre-id"
                required
                autoComplete="off"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gre-secret">Clave secreta del cliente</Label>
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
                <Spinner className={buttonIconClassName} />
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
