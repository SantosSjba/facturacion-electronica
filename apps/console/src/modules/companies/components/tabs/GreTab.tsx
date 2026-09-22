import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useOutletContext, useParams } from "react-router-dom";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { MutedText } from "@/shared/ui/components/muted-text";
import { ErrorState } from "@/shared/ui/ErrorState";
import { cn } from "@/shared/ui/utils";

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
      putGreCredentials(id ?? "", {
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
      <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-800 dark:bg-white/[0.03]">
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
          {ok ? <p className="text-sm text-success-600 dark:text-success-500">{ok}</p> : null}
          <Button
            type="submit"
            size="icon-label"
            aria-label="Guardar GRE"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className={cn(buttonIconClassName, "animate-spin")} />
            ) : (
              <Save className={buttonIconClassName} />
            )}
            <ButtonLabel>
              {mutation.isPending ? "Guardando…" : "Guardar GRE"}
            </ButtonLabel>
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
