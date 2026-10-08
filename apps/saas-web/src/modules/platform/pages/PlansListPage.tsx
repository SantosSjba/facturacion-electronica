import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Building2,
  FileText,
  KeyRound,
  Layers,
  Pencil,
  Plus,
  Save,
  SearchX,
  Users,
  X,
} from "lucide-react";
import { toast } from "@factosys/ui";
import { z } from "zod";

import { ApiError } from "@/shared/api/errors";
import { StatusBadge } from "@/shared/ui/status-badge";
import {
  ActionButton,
  EntityCell,
  RowActions,
  EmptyState,
  ErrorState,
  FieldError,
  FilterPanel,
  countActiveFilters,
  LoadingState,
  PageHeader,
  DEFAULT_PAGE_SIZE,
  Pagination,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Input,
  Label,
  Select,
  Textarea,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@factosys/ui";

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
        icon={Layers}
        title="Planes"
        description="Catálogo SaaS (crear, editar, retirar)."
        actions={
          <ActionButton variant="primary" icon={Plus} label="Crear plan" onClick={openCreate} />
        }
      />

      {query.isLoading ? <LoadingState variant="table" label="Cargando planes…" /> : null}
      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Error al cargar"}
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
              icon={activeFilter ? SearchX : Layers}
              title="Sin planes"
              description="Crea el primer plan o ajusta el filtro."
            />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Plan</TH>
                    <TH>Precio</TH>
                    <TH>Límites</TH>
                    <TH>Estado</TH>
                    <TH className="text-end">Acciones</TH>
                  </TR>
                </THead>
                <TBody>
                  {visible.map((p) => (
                    <TR key={p.id}>
                      <TD label="Plan">
                        <EntityCell
                          icon={Layers}
                          tone={p.active ? "brand" : "muted"}
                          title={p.name}
                          subtitle={<span className="font-mono">{p.code}</span>}
                        />
                      </TD>
                      <TD label="Precio">
                        <span className="font-semibold text-gray-800 dark:text-white/90">
                          {p.price_display}
                        </span>
                        <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                          {" "}
                          / mes
                        </span>
                      </TD>
                      <TD label="Límites">
                        <div className="flex flex-wrap gap-1.5 max-md:justify-end">
                          <LimitChip icon={Building2} value={p.max_companies} title="Empresas" />
                          <LimitChip icon={Users} value={p.max_users} title="Usuarios" />
                          <LimitChip
                            icon={FileText}
                            value={p.max_documents_per_month}
                            title="Documentos por mes"
                          />
                          <LimitChip icon={KeyRound} value={p.max_api_keys} title="API keys" />
                        </div>
                      </TD>
                      <TD label="Estado">
                        <StatusBadge
                          status={p.active ? "active" : "disabled"}
                          label={p.active ? "Activo" : "Retirado"}
                        />
                      </TD>
                      <TD actions>
                        <RowActions>
                          <ActionButton
                            size="icon-sm"
                            icon={Pencil}
                            label="Editar"
                            onClick={() => openEdit(p)}
                          />
                          {p.active ? (
                            <ActionButton
                              size="icon-sm"
                              icon={Archive}
                              label="Retirar"
                              className="text-error-600 dark:text-error-500"
                              pending={
                                retireMutation.isPending && retireMutation.variables === p.id
                              }
                              disabled={retireMutation.isPending}
                              onClick={() => retireMutation.mutate(p.id)}
                            />
                          ) : null}
                        </RowActions>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <Pagination
                page={page}
                pageCount={pageCount}
                total={filtered.length}
                pageSize={pageSize}
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
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === "1" }))}
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
              onChange={(v) => setForm((f) => ({ ...f, max_companies: Number(v) || 0 }))}
            />
            <Field
              label="Max usuarios"
              id="max_users"
              type="number"
              value={String(form.max_users)}
              onChange={(v) => setForm((f) => ({ ...f, max_users: Number(v) || 0 }))}
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
              onChange={(v) => setForm((f) => ({ ...f, max_api_keys: Number(v) || 0 }))}
            />
            <div className="sm:col-span-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          {formError ? <FieldError message={formError} /> : null}
        </DialogBody>
        <DialogFooter>
          <ActionButton
            size="default"
            icon={X}
            label="Cancelar"
            onClick={() => setDialogOpen(false)}
          />
          <ActionButton
            size="default"
            variant="primary"
            icon={Save}
            label="Guardar"
            pending={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          />
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function LimitChip({
  icon: Icon,
  value,
  title,
}: {
  icon: LucideIcon;
  value: number;
  title: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-theme-xs font-medium text-gray-700 dark:bg-white/5 dark:text-gray-300"
    >
      <Icon className="size-3 shrink-0 text-gray-400" aria-hidden />
      {value.toLocaleString("es-PE")}
      <span className="sr-only">{title}</span>
    </span>
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
