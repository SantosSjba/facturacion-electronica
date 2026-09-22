import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { ApiError } from "@/shared/api/errors";
import { useSession } from "@/shared/auth/session-context";
import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { FieldError } from "@/shared/ui/FieldError";
import { LoadingState } from "@/shared/ui/LoadingState";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";

import { createSeries, fetchSeries, patchSeries } from "../../api";

const DOC_TYPES = ["01", "03", "07", "08", "09", "31", "RA", "RC"] as const;

export function SeriesTab() {
  const { id: companyId } = useParams<{ id: string }>();
  const { hasPermission } = useSession();
  const canWrite = hasPermission("series:write");
  const qc = useQueryClient();

  const [documentType, setDocumentType] = useState<string>("01");
  const [serie, setSerie] = useState("");
  const [nextNumber, setNextNumber] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{ serie?: string; nextNumber?: string }>({});

  const query = useQuery({
    queryKey: ["series", companyId],
    queryFn: () => fetchSeries(companyId ?? ""),
    enabled: Boolean(companyId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createSeries(companyId ?? "", {
        document_type: documentType,
        serie,
        next_number: Number(nextNumber) || 1,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["series", companyId] });
      setSerie("");
      setNextNumber("1");
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Error al crear serie");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { seriesId: string; is_active: boolean }) =>
      patchSeries(companyId ?? "", input.seriesId, { is_active: input.is_active }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["series", companyId] });
    },
  });

  if (query.isLoading) return <LoadingState label="Cargando series…" />;
  if (query.error) {
    return (
      <ErrorState
        message={
          query.error instanceof Error
            ? query.error.message
            : "Error al cargar series"
        }
        onRetry={() => void query.refetch()}
      />
    );
  }

  const rows = query.data ?? [];

  return (
    <div className="space-y-6">
      {rows.length === 0 ? (
        <EmptyState
          title="Sin series"
          description="Crea la primera serie documental para esta empresa."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Tipo</TH>
              <TH>Serie</TH>
              <TH>Next</TH>
              <TH>Activa</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {rows.map((s) => (
              <TR key={s.id}>
                <TD className="font-mono">{s.documentType}</TD>
                <TD className="font-mono">{s.serie}</TD>
                <TD>{s.nextNumber}</TD>
                <TD>
                  <Badge variant={s.isActive ? "success" : "muted"}>
                    {s.isActive ? "sí" : "no"}
                  </Badge>
                </TD>
                <TD>
                  {canWrite ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={toggleMutation.isPending}
                      onClick={() =>
                        toggleMutation.mutate({
                          seriesId: s.id,
                          is_active: !s.isActive,
                        })
                      }
                    >
                      {s.isActive ? "Desactivar" : "Activar"}
                    </Button>
                  ) : null}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {canWrite ? (
        <form
          className="max-w-lg space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const nextErrors: { serie?: string; nextNumber?: string } = {};
            if (!/^[A-Z0-9]{1,8}$/.test(serie)) nextErrors.serie = "Usa de 1 a 8 letras mayúsculas o números";
            if (!/^\d+$/.test(nextNumber) || Number(nextNumber) < 1) nextErrors.nextNumber = "Ingresa un correlativo entero mayor a cero";
            setFormErrors(nextErrors);
            if (Object.keys(nextErrors).length > 0) return;
            createMutation.mutate();
          }}
        >
          <h3 className="text-sm font-semibold">Crear serie</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="doc-type">Tipo</Label>
              <Select
                id="doc-type"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="serie">Serie</Label>
              <Input
                id="serie"
                required
                maxLength={8}
                value={serie}
                aria-invalid={Boolean(formErrors.serie)}
                onChange={(e) => setSerie(e.target.value.toUpperCase())}
              />
              <FieldError message={formErrors.serie} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next">Next number</Label>
              <Input
                id="next"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={nextNumber}
                aria-invalid={Boolean(formErrors.nextNumber)}
                onChange={(e) => setNextNumber(e.target.value.replace(/\D/g, ""))}
              />
              <FieldError message={formErrors.nextNumber} />
            </div>
          </div>
          {error ? <ErrorState title="Error" message={error} /> : null}
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creando…" : "Crear serie"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
