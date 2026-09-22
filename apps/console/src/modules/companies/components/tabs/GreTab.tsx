import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutletContext, useParams } from "react-router-dom";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { ErrorState } from "@/shared/ui/ErrorState";

import { putGreCredentials } from "../../api";
import type { Company } from "../../types";

export function GreTab() {
  const { id } = useParams<{ id: string }>();
  const { company } = useOutletContext<{ company: Company }>();
  const { hasPermission } = useSession();
  const canManage = hasPermission("credentials:manage");
  const qc = useQueryClient();

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const summary = company.credentials_summary?.gre;

  const mutation = useMutation({
    mutationFn: () =>
      putGreCredentials(id!, {
        client_id: clientId,
        client_secret: clientSecret,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["company", id] });
      await qc.invalidateQueries({ queryKey: ["companies"] });
      setClientSecret("");
      setOk("Credenciales GRE guardadas");
      setError(null);
    },
    onError: (err) => {
      setOk(null);
      setError(err instanceof ApiError ? err.message : "Error GRE");
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 text-sm">
        <p>
          Configurado:{" "}
          <strong>{company.gre_configured ? "sí" : "no"}</strong>
        </p>
        {summary ? (
          <>
            <p className="mt-2">
              Client ID:{" "}
              <span className="font-mono">{summary.client_id ?? "—"}</span>
            </p>
            <p className="text-[var(--muted-foreground)]">
              Rotated: {summary.rotated_at ?? "—"}
            </p>
          </>
        ) : null}
      </div>

      {canManage ? (
        <form
          className="max-w-md space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="gre-id">Client ID</Label>
            <Input
              id="gre-id"
              required
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
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </div>
          {error ? <ErrorState title="Error" message={error} /> : null}
          {ok ? <p className="text-sm text-teal-700">{ok}</p> : null}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando…" : "Guardar GRE"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-[var(--muted-foreground)]">
          Requiere credentials:manage.
        </p>
      )}
    </div>
  );
}
