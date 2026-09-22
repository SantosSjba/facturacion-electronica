import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutletContext, useParams } from "react-router-dom";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { ErrorState } from "@/shared/ui/ErrorState";

import { putCertificate } from "../../api";
import type { Company } from "../../types";

export function CertificateTab() {
  const { id } = useParams<{ id: string }>();
  const { company } = useOutletContext<{ company: Company }>();
  const { hasPermission } = useSession();
  const canManage = hasPermission("credentials:manage");
  const qc = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const summary = company.credentials_summary?.certificate;

  const mutation = useMutation({
    mutationFn: () => putCertificate(id!, file!, password),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["company", id] });
      await qc.invalidateQueries({ queryKey: ["companies"] });
      setPassword("");
      setFile(null);
      setOk("Certificado actualizado");
      setError(null);
    },
    onError: (err) => {
      setOk(null);
      setError(err instanceof ApiError ? err.message : "Error al subir PFX");
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="mb-3 text-sm font-semibold">Estado actual</h3>
        {summary ? (
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            <Row label="Status" value={summary.status} />
            <Row label="CN" value={summary.subject_cn ?? "—"} />
            <Row label="Not before" value={summary.not_before ?? "—"} />
            <Row label="Not after" value={summary.not_after ?? "—"} />
            <Row label="Rotated" value={summary.rotated_at ?? "—"} />
          </dl>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            Sin certificado ({company.certificate_status})
          </p>
        )}
      </div>

      {canManage ? (
        <form
          className="max-w-md space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
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
          <h3 className="text-sm font-semibold">Subir PFX</h3>
          <div className="space-y-1.5">
            <Label htmlFor="pfx">Archivo</Label>
            <Input
              id="pfx"
              type="file"
              accept=".pfx,.p12"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pfx-pass">Contraseña (write-only)</Label>
            <Input
              id="pfx-pass"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <ErrorState title="Error" message={error} /> : null}
          {ok ? <p className="text-sm text-teal-700">{ok}</p> : null}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Subiendo…" : "Subir certificado"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-[var(--muted-foreground)]">
          Requiere permiso credentials:manage para subir.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted-foreground)]">{label}</dt>
      <dd className="font-mono text-xs">{value}</dd>
    </div>
  );
}
