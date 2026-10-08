import { certificateLabel, formatDateTime } from "@/shared/ui/display-labels";
import { CertificateBadge } from "@/shared/ui/status-badge";
import { Spinner } from "@factosys/ui";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  CalendarX,
  Lock,
  RefreshCw,
  ShieldCheck,
  Upload,
  UserSquare,
  X,
} from "lucide-react";
import { useOutletContext, useParams } from "react-router-dom";

import { ApiError } from "@/shared/api/errors";
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
  FileInput,
  Label,
  InfoField,
  InfoGrid,
  MutedText,
  ErrorState,
  SectionCard,
} from "@factosys/ui";

import { toast } from "@/shared/ui/toaster";

import { putCertificate } from "../../api";
import type { Company } from "../../types";

export function CertificateTab() {
  const { id } = useParams<{ id: string }>();
  const { company } = useOutletContext<{ company: Company }>();
  const { hasPermission } = useSession();
  const canManage = hasPermission("credentials:manage");
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const summary = company.credentials_summary?.certificate;
  const certOk = company.certificate_status === "active";

  const mutation = useMutation({
    mutationFn: () => {
      if (!id || !file) throw new Error("Selecciona un certificado válido");
      return putCertificate(id, file, password);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["company", id] });
      await qc.invalidateQueries({ queryKey: ["companies"] });
      setPassword("");
      setFile(null);
      setError(null);
      setOpen(false);
      toast.success("Certificado actualizado");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Error al subir PFX");
    },
  });

  function handleClose() {
    if (mutation.isPending) return;
    setOpen(false);
    setError(null);
    setFile(null);
    setPassword("");
  }

  return (
    <div className="space-y-4">
      <SectionCard
        icon={ShieldCheck}
        tone={certOk ? "success" : "muted"}
        title="Estado del certificado"
        description={<CertificateBadge status={company.certificate_status} />}
        actions={
          canManage ? (
            <ActionButton
              variant="primary"
              icon={Upload}
              label="Subir PFX"
              onClick={() => setOpen(true)}
            />
          ) : null
        }
      >
        {summary ? (
          <InfoGrid className="lg:grid-cols-3">
            <InfoField icon={ShieldCheck} label="Estado" value={certificateLabel(summary.status)} />
            <InfoField icon={UserSquare} label="CN" value={summary.subject_cn} mono />
            <InfoField
              icon={CalendarCheck}
              label="Vigente desde"
              value={formatDateTime(summary.not_before)}
            />
            <InfoField
              icon={CalendarX}
              label="Vigente hasta"
              value={formatDateTime(summary.not_after)}
            />
            <InfoField
              icon={RefreshCw}
              label="Última renovación"
              value={formatDateTime(summary.rotated_at)}
            />
          </InfoGrid>
        ) : (
          <MutedText>
            Sin certificado cargado. Aunque la empresa esté en el ambiente de pruebas, hace falta un
            .pfx / .p12 para firmar el XML (certificado de prueba SUNAT o uno autogenerado en
            entorno Fake).
          </MutedText>
        )}

        {!canManage ? (
          <MutedText className="mt-4 flex items-center gap-1.5">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            Requiere permiso credentials:manage para subir.
          </MutedText>
        ) : null}
      </SectionCard>

      <Dialog
        open={open}
        onClose={handleClose}
        ariaLabel="Subir certificado PFX"
        size="sm"
        closeOnBackdrop={!mutation.isPending}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!file) {
              setError("Selecciona un archivo .pfx / .p12");
              return;
            }
            mutation.mutate();
          }}
        >
          <DialogHeader
            title="Subir certificado PFX"
            description="El archivo y la contraseña se almacenan de forma cifrada (write-only)."
            onClose={handleClose}
          />
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pfx">Archivo</Label>
              <FileInput
                id="pfx"
                accept=".pfx,.p12"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? <MutedText className="text-xs">{file.name}</MutedText> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pfx-pass">Contraseña (write-only)</Label>
              <Input
                id="pfx-pass"
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
              aria-label="Subir certificado"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <Spinner className={buttonIconClassName} />
              ) : (
                <Upload className={buttonIconClassName} />
              )}
              <ButtonLabel>{mutation.isPending ? "Subiendo…" : "Subir"}</ButtonLabel>
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
