import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutletContext, useParams } from "react-router-dom";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { ErrorState } from "@/shared/ui/ErrorState";

import { putSolCredentials } from "../../api";
import type { Company } from "../../types";

export function SolTab() {
  const { id } = useParams<{ id: string }>();
  const { company } = useOutletContext<{ company: Company }>();
  const { hasPermission } = useSession();
  const canManage = hasPermission("credentials:manage");
  const qc = useQueryClient();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const summary = company.credentials_summary?.sol;

  const mutation = useMutation({
    mutationFn: () => putSolCredentials(id!, { username, password }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["company", id] });
      await qc.invalidateQueries({ queryKey: ["companies"] });
      setPassword("");
      setOk("Credenciales SOL guardadas");
      setError(null);
    },
    onError: (err) => {
      setOk(null);
      setError(err instanceof ApiError ? err.message : "Error SOL");
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 text-sm">
        <p>
          Configurado:{" "}
          <strong>{company.sol_configured ? "sí" : "no"}</strong>
        </p>
        {summary ? (
          <>
            <p className="mt-2">
              Usuario: <span className="font-mono">{summary.username ?? "—"}</span>
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
            <Label htmlFor="sol-user">Usuario SOL</Label>
            <Input
              id="sol-user"
              required
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <ErrorState title="Error" message={error} /> : null}
          {ok ? <p className="text-sm text-teal-700">{ok}</p> : null}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando…" : "Guardar SOL"}
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
