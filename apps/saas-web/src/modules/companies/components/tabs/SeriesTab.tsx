import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hash, Loader2, Plus, Power, PowerOff, Sparkles, X } from "lucide-react";
import { useParams } from "react-router-dom";

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
  Label,
  Select,
  EmptyState,
  ErrorState,
  FieldError,
  LoadingState,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  cn,
} from "@factosys/ui";

import { toast } from "@/shared/ui/toaster";

import { createSeries, fetchSeries, patchSeries } from "../../api";
import { DEFAULT_COMPANY_SERIES } from "../../default-series";

const DOC_TYPES = ["01", "03", "07", "08", "09", "31", "RA", "RC"] as const;

const DOC_TYPE_LABELS: Record<string, string> = {
  "01": "Factura",
  "03": "Boleta",
  "07": "Nota de crédito",
  "08": "Nota de débito",
  "09": "GRE remitente",
  "31": "GRE transportista",
  RA: "Comunicación de baja",
  RC: "Resumen diario",
};

export function SeriesTab() {
  const { id: companyId } = useParams<{ id: string }>();
  const { hasPermission } = useSession();
  const canWrite = hasPermission("series:write");
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [documentType, setDocumentType] = useState<string>("01");
  const [serie, setSerie] = useState("");
  const [nextNumber, setNextNumber] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{
    serie?: string;
    nextNumber?: string;
  }>({});

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
      setFormErrors({});
      setOpen(false);
      toast.success("Serie creada");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Error al crear serie");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { seriesId: string; is_active: boolean }) =>
      patchSeries(companyId ?? "", input.seriesId, {
        is_active: input.is_active,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["series", companyId] });
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const id = companyId ?? "";
      for (const s of DEFAULT_COMPANY_SERIES) {
        await createSeries(id, {
          document_type: s.document_type,
          serie: s.serie,
          next_number: 1,
        });
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["series", companyId] });
      toast.success("Series iniciales creadas", {
        description: "F001, B001, FC01, FD01, T001, V001",
      });
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudieron crear las series iniciales",
      );
    },
  });

  function handleClose() {
    if (createMutation.isPending) return;
    setOpen(false);
    setError(null);
    setFormErrors({});
  }

  function handleOpen() {
    setDocumentType("01");
    setSerie("");
    setNextNumber("1");
    setError(null);
    setFormErrors({});
    setOpen(true);
  }

  if (query.isLoading) return <LoadingState label="Cargando series…" />;
  if (query.error) {
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : "Error al cargar series"}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const rows = query.data ?? [];
  const activeCount = rows.filter((s) => s.isActive).length;

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
              <Hash className="size-5" />
            </span>
            <div>
              <CardTitle className="mb-0.5">Series documentales</CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {rows.length === 0
                  ? "Aún no hay series"
                  : `${activeCount} activas · ${rows.length} en total`}
              </p>
            </div>
          </div>
          {canWrite ? (
            <Button
              type="button"
              size="icon-label-sm"
              aria-label="Crear serie"
              onClick={handleOpen}
            >
              <Plus className={buttonIconClassName} />
              <ButtonLabel>Crear serie</ButtonLabel>
            </Button>
          ) : null}
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="Sin series"
          description="Crea las series iniciales (F001, B001, etc.) o agrega una serie manualmente."
          action={
            canWrite ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  size="icon-label-sm"
                  aria-label="Crear series iniciales"
                  disabled={seedMutation.isPending}
                  onClick={() => seedMutation.mutate()}
                >
                  {seedMutation.isPending ? (
                    <Loader2 className={cn(buttonIconClassName, "animate-spin")} />
                  ) : (
                    <Sparkles className={buttonIconClassName} />
                  )}
                  <ButtonLabel>
                    {seedMutation.isPending ? "Creando…" : "Crear series iniciales"}
                  </ButtonLabel>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-label-sm"
                  aria-label="Crear serie"
                  onClick={handleOpen}
                >
                  <Plus className={buttonIconClassName} />
                  <ButtonLabel>Crear una serie</ButtonLabel>
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden p-0 sm:p-0 max-md:border-0 max-md:bg-transparent">
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
                  <TD label="Tipo">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs">{s.documentType}</span>
                      <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                        {DOC_TYPE_LABELS[s.documentType] ?? "Documento"}
                      </span>
                    </div>
                  </TD>
                  <TD label="Serie" className="font-mono">
                    {s.serie}
                  </TD>
                  <TD label="Next" className="font-mono">
                    {s.nextNumber}
                  </TD>
                  <TD label="Activa">
                    <Badge variant={s.isActive ? "success" : "muted"}>
                      {s.isActive ? "sí" : "no"}
                    </Badge>
                  </TD>
                  <TD actions>
                    {canWrite ? (
                      <Button
                        type="button"
                        size="icon-label-sm"
                        variant="outline"
                        aria-label={s.isActive ? "Desactivar" : "Activar"}
                        disabled={toggleMutation.isPending}
                        onClick={() =>
                          toggleMutation.mutate({
                            seriesId: s.id,
                            is_active: !s.isActive,
                          })
                        }
                      >
                        {s.isActive ? (
                          <PowerOff className={buttonIconClassName} />
                        ) : (
                          <Power className={buttonIconClassName} />
                        )}
                        <ButtonLabel>{s.isActive ? "Desactivar" : "Activar"}</ButtonLabel>
                      </Button>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <Dialog
        open={open}
        onClose={handleClose}
        ariaLabel="Crear serie"
        size="md"
        closeOnBackdrop={!createMutation.isPending}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const nextErrors: { serie?: string; nextNumber?: string } = {};
            if (!/^[A-Z0-9]{1,8}$/.test(serie)) {
              nextErrors.serie = "Usa de 1 a 8 letras mayúsculas o números";
            }
            if (!/^\d+$/.test(nextNumber) || Number(nextNumber) < 1) {
              nextErrors.nextNumber = "Ingresa un correlativo entero mayor a cero";
            }
            setFormErrors(nextErrors);
            if (Object.keys(nextErrors).length > 0) return;
            createMutation.mutate();
          }}
        >
          <DialogHeader
            title="Crear serie"
            description="Define el tipo de documento, la serie y el correlativo inicial."
            onClose={handleClose}
          />
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="doc-type">Tipo de documento</Label>
              <Select
                id="doc-type"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t} — {DOC_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="serie">Serie</Label>
                <Input
                  id="serie"
                  required
                  maxLength={8}
                  value={serie}
                  placeholder="F001"
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
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="icon-label-sm"
              aria-label="Cancelar"
              disabled={createMutation.isPending}
              onClick={handleClose}
            >
              <X className={buttonIconClassName} />
              <ButtonLabel>Cancelar</ButtonLabel>
            </Button>
            <Button
              type="submit"
              size="icon-label-sm"
              aria-label="Crear serie"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className={cn(buttonIconClassName, "animate-spin")} />
              ) : (
                <Plus className={buttonIconClassName} />
              )}
              <ButtonLabel>{createMutation.isPending ? "Creando…" : "Crear"}</ButtonLabel>
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
