import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutletContext, useParams } from "react-router-dom";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { MutedText } from "@/shared/ui/components/muted-text";
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
    mutationFn: () => putSolCredentials(id ?? "", { username, password }),
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
      <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <p>
          Configurado:{" "}
          <strong>{company.sol_configured ? "sí" : "no"}</strong>
        </p>
        {summary ? (
          <>
            <p className="mt-2">
              Usuario: <span className="font-mono">{summary.username ?? "—"}</span>
            </p>
            <MutedText>
              Rotated: {summary.rotated_at ?? "—"}
            </MutedText>
          </>
        ) : null}
      </div>

      {canManage ? (
        <form
          className="max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
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
          {ok ? <p className="text-sm text-success-600 dark:text-success-500">{ok}</p> : null}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando…" : "Guardar SOL"}
          </Button>
        </form>
      ) : (
        <MutedText>
          Requiere credentials:manage.
        </MutedText>
      )}
    </div>
  );
}
