import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { ApiError } from "@/shared/api/errors";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { FieldError } from "@/shared/ui/FieldError";
import { FilterPanel, countActiveFilters } from "@/shared/ui/FilterPanel";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/shared/ui/Pagination";
import { Badge } from "@/shared/ui/components/badge";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";
import { Textarea } from "@/shared/ui/components/textarea";
import {
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/shared/ui/components/table";

import {
  createPlan,
  fetchAdminPlans,
  patchPlan,
  retirePlan,
  type Plan,
  type PlanWriteBody,
} from "../api/plans";

const planSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  description: z.string().max(4000).optional(),
  price_monthly_cents: z.coerce.number().int().min(0),
  price_display: z.string().min(1).max(64),
  currency: z.string().length(3),
  max_companies: z.coerce.number().int().min(0),
  max_users: z.coerce.number().int().min(0),
  max_documents_per_month: z.coerce.number().int().min(0),
  max_api_keys: z.coerce.number().int().min(0),
  active: z.boolean(),
});

type PlanFormState = z.infer<typeof planSchema>;

const emptyForm = (): PlanFormState => ({
  code: "",
  name: "",
  description: "",
  price_monthly_cents: 0,
  price_display: "S/ 0",
  currency: "PEN",
  max_companies: 1,
  max_users: 2,
  max_documents_per_month: 100,
  max_api_keys: 1,
  active: true,
});

function fromPlan(p: Plan): PlanFormState {
  return {
    code: p.code,
    name: p.name,
    description: p.description ?? "",
    price_monthly_cents: p.price_monthly_cents,
    price_display: p.price_display,
    currency: p.currency,
    max_companies: p.max_companies,
    max_users: p.max_users,
    max_documents_per_month: p.max_documents_per_month,
    max_api_keys: p.max_api_keys,
    active: p.active,
  };
}

export function PlansListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = searchParams.get("active");
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["platform", "plans"],
    queryFn: fetchAdminPlans,
  });

  const filtered = useMemo(() => {
    const items = query.data?.items ?? [];
    if (activeFilter === "0") return items.filter((p) => !p.active);
    if (activeFilter === "1") return items.filter((p) => p.active);
    return items;
  }, [query.data, activeFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [activeFilter, pageSize]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = planSchema.safeParse(form);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      }
      const body: PlanWriteBody = {
        ...parsed.data,
        description: parsed.data.description || null,
      };
      if (editing) {
        return patchPlan(editing.id, body);
      }
      return createPlan(body);
    },
    onSuccess: async () => {
      toast.success(editing ? "Plan actualizado" : "Plan creado");
      setDialogOpen(false);
      setEditing(null);
      setFormError(null);
      await qc.invalidateQueries({ queryKey: ["platform", "plans"] });
      await qc.invalidateQueries({ queryKey: ["platform", "stats"] });
    },
    onError: (err) => {
      setFormError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error al guardar",
      );
    },
  });

  const retireMutation = useMutation({
    mutationFn: (id: string) => retirePlan(id),
    onSuccess: async () => {
      toast.success("Plan retirado");
      await qc.invalidateQueries({ queryKey: ["platform", "plans"] });
      await qc.invalidateQueries({ queryKey: ["platform", "stats"] });
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error al retirar",
      );
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditing(plan);
    setForm(fromPlan(plan));
    setFormError(null);
    setDialogOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Planes"
        description="Catálogo SaaS (crear, editar, retirar)."
        actions={
          <Button
            type="button"
            size="icon-label-sm"
            aria-label="Crear plan"
            onClick={openCreate}
          >
            <Plus className={buttonIconClassName} />
            <ButtonLabel>Crear plan</ButtonLabel>
          </Button>
        }
      />

      {query.isLoading ? <LoadingState label="Cargando planes…" /> : null}
      {query.error ? (
        <ErrorState
          message={
            query.error instanceof Error
              ? query.error.message
              : "Error al cargar"
          }
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error ? (
        <div className="space-y-4">
          <FilterPanel
            activeCount={countActiveFilters({
              active: activeFilter || undefined,
            })}
            onClear={() => setSearchParams({})}
          >
            <div>
              <Label htmlFor="active-filter">Visibilidad</Label>
              <Select
                id="active-filter"
                value={activeFilter ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) setSearchParams({});
                  else setSearchParams({ active: v });
                }}
              >
                <option value="">Todos</option>
                <option value="1">Activos</option>
                <option value="0">Retirados</option>
              </Select>
            </div>
          </FilterPanel>

          {filtered.length === 0 ? (
            <EmptyState
              title="Sin planes"
              description="Crea el primer plan o ajusta el filtro."
            />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Código</TH>
                    <TH>Nombre</TH>
                    <TH>Precio</TH>
                    <TH>Límites</TH>
                    <TH>Estado</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {visible.map((p) => (
                    <TR key={p.id}>
                      <TD className="font-mono text-sm">{p.code}</TD>
                      <TD className="font-medium">{p.name}</TD>
                      <TD>{p.price_display}</TD>
                      <TD className="text-theme-xs text-gray-500">
                        {p.max_companies} emp · {p.max_users} usr ·{" "}
                        {p.max_documents_per_month} docs · {p.max_api_keys} keys
                      </TD>
                      <TD>
                        <Badge color={p.active ? "success" : "muted"}>
                          {p.active ? "Activo" : "Retirado"}
                        </Badge>
                      </TD>
                      <TD>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(p)}
                          >
                            Editar
                          </Button>
                          {p.active ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={retireMutation.isPending}
                              onClick={() => retireMutation.mutate(p.id)}
                            >
                              Retirar
                            </Button>
                          ) : null}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>
          )}
        </div>
      ) : null}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        ariaLabel={editing ? "Editar plan" : "Crear plan"}
        size="lg"
      >
        <DialogHeader
          title={editing ? "Editar plan" : "Crear plan"}
          onClose={() => setDialogOpen(false)}
        />
        <DialogBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Código"
              id="code"
              value={form.code}
              disabled={Boolean(editing)}
              onChange={(v) => setForm((f) => ({ ...f, code: v }))}
            />
            <Field
              label="Nombre"
              id="name"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            />
            <Field
              label="Precio display"
              id="price_display"
              value={form.price_display}
              onChange={(v) => setForm((f) => ({ ...f, price_display: v }))}
            />
            <Field
              label="Cents / mes"
              id="price_monthly_cents"
              type="number"
              value={String(form.price_monthly_cents)}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  price_monthly_cents: Number(v) || 0,
                }))
              }
            />
            <Field
              label="Moneda"
              id="currency"
              value={form.currency}
              onChange={(v) => setForm((f) => ({ ...f, currency: v }))}
            />
            <div>
              <Label htmlFor="active">Activo</Label>
              <Select
                id="active"
                value={form.active ? "1" : "0"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.value === "1" }))
                }
              >
                <option value="1">Sí</option>
                <option value="0">No</option>
              </Select>
            </div>
            <Field
              label="Max empresas"
              id="max_companies"
              type="number"
              value={String(form.max_companies)}
              onChange={(v) =>
                setForm((f) => ({ ...f, max_companies: Number(v) || 0 }))
              }
            />
            <Field
              label="Max usuarios"
              id="max_users"
              type="number"
              value={String(form.max_users)}
              onChange={(v) =>
                setForm((f) => ({ ...f, max_users: Number(v) || 0 }))
              }
            />
            <Field
              label="Max docs / mes"
              id="max_documents_per_month"
              type="number"
              value={String(form.max_documents_per_month)}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  max_documents_per_month: Number(v) || 0,
                }))
              }
            />
            <Field
              label="Max API keys"
              id="max_api_keys"
              type="number"
              value={String(form.max_api_keys)}
              onChange={(v) =>
                setForm((f) => ({ ...f, max_api_keys: Number(v) || 0 }))
              }
            />
            <div className="sm:col-span-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={form.description ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
              />
            </div>
          </div>
          {formError ? <FieldError message={formError} /> : null}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDialogOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Guardar
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
  disabled,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
