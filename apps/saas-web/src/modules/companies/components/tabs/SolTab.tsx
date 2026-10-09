import { Spinner } from "@factosys/ui";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, KeyRound, Lock, Save, Settings2, UserRound, X } from "lucide-react";
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

import { putSolCredentials } from "../../api";
import type { Company } from "../../types";
import { solUsernameForApi, solUsernameForInput } from "../../sol-username";

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
    mutationFn: () =>
      putSolCredentials(id ?? "", {
        username: solUsernameForApi(company.ruc, username),
        password,
      }),
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
    setUsername(solUsernameForInput(company.ruc, summary?.username));
    setPassword("");
    setError(null);
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <SectionCard
        icon={KeyRound}
        tone={company.sol_configured ? "success" : "muted"}
        title="Clave SOL"
        description={
          <StatusBadge
            status={company.sol_configured ? "active" : "disabled"}
            label={company.sol_configured ? "Configurado" : "Sin configurar"}
          />
        }
        actions={
          canManage ? (
            <ActionButton
              variant="primary"
              icon={Settings2}
              label={company.sol_configured ? "Actualizar SOL" : "Configurar SOL"}
              onClick={handleOpen}
            />
          ) : null
        }
      >
        {summary ? (
          <InfoGrid>
            <InfoField icon={UserRound} label="Usuario" value={summary.username} mono />
            <InfoField
              icon={CalendarClock}
              label="Última actualización"
              value={formatDateTime(summary.rotated_at)}
            />
          </InfoGrid>
        ) : (
          <MutedText>Credenciales del usuario secundario SUNAT (SOL) para envío de CPE.</MutedText>
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
            description="Usuario y contraseña secundarios SUNAT. La contraseña se guarda de forma cifrada y no se muestra después."
            onClose={handleClose}
          />
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sol-user">Usuario SOL</Label>
              <Input
                id="sol-user"
                required
                autoComplete="username"
                aria-describedby="sol-user-help"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <p id="sol-user-help" className="text-sm text-muted-foreground">
                Ingresa el usuario secundario. Añadiremos automáticamente el RUC {company.ruc}.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sol-pass">Contraseña SOL</Label>
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
