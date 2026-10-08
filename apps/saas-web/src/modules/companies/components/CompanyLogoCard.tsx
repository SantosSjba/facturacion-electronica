import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image, Trash2, Upload, X } from "lucide-react";
import { Button, FileInput, Label, SectionCard } from "@factosys/ui";
import { useSession } from "@/shared/auth/session-context";
import { toast } from "@/shared/ui/toaster";
import { deleteCompanyLogo, fetchCompanyLogo, putCompanyLogo } from "../api";
import type { Company } from "../types";

export function CompanyLogoCard({ company }: { company: Company }) {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("companies:write");
  const qc = useQueryClient();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logo = useQuery({
    queryKey: ["company-logo", company.id, company.logo?.sha256],
    queryFn: () => fetchCompanyLogo(company.id),
    enabled: Boolean(company.logo),
  });

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function clearSelection() {
    setFile(null);
    setError(null);
    if (input.current) input.current.value = "";
  }

  const mutation = useMutation({
    mutationFn: async (action: "upload" | "delete") => {
      if (action === "delete") return deleteCompanyLogo(company.id);
      if (!file) throw new Error("Selecciona una imagen");
      return putCompanyLogo(company.id, file);
    },
    onSuccess: async (result, action) => {
      if (result?.logo) qc.setQueryData(["company-logo", company.id, result.logo.sha256], result);
      clearSelection();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["company", company.id] }),
        qc.invalidateQueries({ queryKey: ["companies"] }),
        qc.invalidateQueries({ queryKey: ["company-logo", company.id] }),
      ]);
      toast.success(action === "upload" ? "Logo actualizado" : "Logo eliminado");
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "No se pudo actualizar el logo"),
  });

  const image = preview ?? (company.logo ? logo.data?.data_url : null);
  return (
    <SectionCard icon={Image} title="Logo de la empresa">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex min-h-36 w-full shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white p-4 sm:w-56 dark:border-gray-700">
          {image ? (
            <img
              src={image}
              alt={preview ? "Vista previa del nuevo logo" : `Logo de ${company.legal_name}`}
              className="max-h-32 max-w-full object-contain"
            />
          ) : (
            <span className="text-sm text-gray-500">
              {company.logo && logo.isLoading ? "Cargando logo…" : "Sin logo"}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Aparece automáticamente en los PDF de facturas, boletas y notas de crédito y débito
            emitidos por la API. Los cambios se aplican a nuevas emisiones.
          </p>
          {canWrite ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={inputId}>{company.logo ? "Reemplazar logo" : "Subir logo"}</Label>
                <FileInput
                  ref={input}
                  id={inputId}
                  accept="image/png,image/jpeg,image/webp"
                  disabled={mutation.isPending}
                  onChange={(event) => {
                    const selected = event.target.files?.[0] ?? null;
                    setError(null);
                    if (
                      selected &&
                      (!["image/png", "image/jpeg", "image/webp"].includes(selected.type) ||
                        selected.size > 2 * 1024 * 1024 ||
                        !selected.size)
                    ) {
                      setError("Selecciona una imagen PNG, JPG o WebP de hasta 2 MB.");
                      setFile(null);
                      event.target.value = "";
                      return;
                    }
                    setFile(selected);
                  }}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  PNG, JPG o WebP · Hasta 2 MB y 16 megapíxeles. Se conserva la proporción y la
                  transparencia.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {file ? (
                  <>
                    <Button
                      size="sm"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate("upload")}
                    >
                      <Upload className="size-4" />
                      {mutation.isPending ? "Guardando…" : "Guardar logo"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mutation.isPending}
                      onClick={clearSelection}
                    >
                      <X className="size-4" />
                      Cancelar
                    </Button>
                  </>
                ) : null}
                {company.logo && !file ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate("delete")}
                  >
                    <Trash2 className="size-4" />
                    {mutation.isPending ? "Eliminando…" : "Eliminar logo"}
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-error-600 dark:text-error-400">
              {error}
            </p>
          ) : null}
          {company.logo && logo.isError ? (
            <div role="alert" className="text-sm text-error-600 dark:text-error-400">
              No se pudo cargar el logo.{" "}
              <button type="button" className="underline" onClick={() => void logo.refetch()}>
                Reintentar
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}
