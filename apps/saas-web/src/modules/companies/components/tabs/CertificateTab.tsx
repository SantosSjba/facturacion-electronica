import { Spinner } from "@factosys/ui";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Upload, X } from "lucide-react";
import { useOutletContext, useParams } from "react-router-dom";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import {
  Badge,
  Button,
  ButtonLabel,
  buttonIconClassName,
  Card,
  CardTitle,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Input,
  FileInput,
  Label,
  MutedText,
  ErrorState,
  cn,
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
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-xl",
                certOk
                  ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500"
                  : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
              )}
            >
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <CardTitle className="mb-1">Estado del certificado</CardTitle>
              <Badge variant={certOk ? "success" : "muted"}>{company.certificate_status}</Badge>
            </div>
          </div>
          {canManage ? (
            <Button
              type="button"
              size="icon-label-sm"
              aria-label="Subir PFX"
              onClick={() => setOpen(true)}
            >
              <Upload className={buttonIconClassName} />
              <ButtonLabel>Subir PFX</ButtonLabel>
            </Button>
          ) : null}
        </div>

        {summary ? (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Row label="Status" value={summary.status} />
            <Row label="CN" value={summary.subject_cn ?? "—"} />
            <Row label="Not before" value={summary.not_before ?? "—"} />
            <Row label="Not after" value={summary.not_after ?? "—"} />
            <Row label="Rotated" value={summary.rotated_at ?? "—"} />
          </dl>
        ) : (
          <MutedText>
            Sin certificado cargado. Aunque la empresa esté en sandbox, hace falta un .pfx / .p12
            para firmar el XML (certificado de prueba SUNAT o uno autogenerado en entorno Fake).
          </MutedText>
        )}

        {!canManage ? (
          <MutedText className="mt-4">Requiere permiso credentials:manage para subir.</MutedText>
        ) : null}
      </Card>

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
