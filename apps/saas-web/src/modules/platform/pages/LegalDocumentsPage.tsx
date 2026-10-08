import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, Hash, Pencil, Plus, Save, Scale, SearchX, Send, X } from "lucide-react";
import { toast } from "@factosys/ui";
import { z } from "zod";

import { ApiError } from "@/shared/api/errors";
import { formatDateTime } from "@/shared/ui/display-labels";
import { StatusBadge } from "@/shared/ui/status-badge";
import {
  ActionButton,
  EntityCell,
  MutedText,
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
  Badge,
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
  createLegalDocument,
  fetchLegalDocuments,
  patchLegalDocument,
  publishLegalDocument,
  type LegalDocument,
} from "../api/legal";

const formSchema = z.object({
  code: z.string().min(1).max(128),
  version: z.coerce.number().int().min(1),
  title: z.string().min(1).max(512),
  body_md: z.string().min(1),
});

type FormState = z.infer<typeof formSchema>;

const emptyForm = (): FormState => ({
  code: "",
  version: 1,
  title: "",
  body_md: "",
});

function fromDoc(d: LegalDocument): FormState {
  return {
    code: d.code,
    version: d.version,
    title: d.title,
    body_md: d.body_md,
  };
}

function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : hash;
}

export function LegalDocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") as "draft" | "published" | null;
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LegalDocument | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [publishConfirm, setPublishConfirm] = useState<LegalDocument | null>(null);

  const query = useQuery({
    queryKey: ["platform", "legal"],
    queryFn: () => fetchLegalDocuments(),
  });

  const filtered = useMemo(() => {
    const items = query.data?.items ?? [];
    if (statusFilter === "draft" || statusFilter === "published") {
      return items.filter((d) => d.status === statusFilter);
    }
    return items;
  }, [query.data, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [statusFilter, pageSize]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = formSchema.safeParse(form);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      }
      if (editing) {
        if (editing.status !== "draft") {
          throw new Error("Solo se pueden editar borradores");
        }
        return patchLegalDocument(editing.id, {
          title: parsed.data.title,
          body_md: parsed.data.body_md,
          version: parsed.data.version,
        });
      }
      return createLegalDocument({
        code: parsed.data.code,
        version: parsed.data.version,
        title: parsed.data.title,
        body_md: parsed.data.body_md,
      });
    },
    onSuccess: async () => {
      toast.success(editing ? "Documento actualizado" : "Borrador creado");
      setDialogOpen(false);
      setEditing(null);
      setFormError(null);
      await qc.invalidateQueries({ queryKey: ["platform", "legal"] });
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

  const publishMutation = useMutation({
    mutationFn: (id: string) => publishLegalDocument(id),
    onSuccess: async () => {
      toast.success("Documento publicado");
      setPublishConfirm(null);
      await qc.invalidateQueries({ queryKey: ["platform", "legal"] });
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error al publicar",
      );
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(doc: LegalDocument) {
    if (doc.status !== "draft") {
      toast.error("Los documentos publicados son inmutables");
      return;
    }
    setEditing(doc);
    setForm(fromDoc(doc));
    setFormError(null);
    setDialogOpen(true);
  }

  return (
    <div>
      <PageHeader
        icon={Scale}
        title="Legal"
        description="Documentos legales (borrador → publicar). Publicados son inmutables."
        actions={
          <ActionButton variant="primary" icon={Plus} label="Crear borrador" onClick={openCreate} />
        }
      />

      {query.isLoading ? <LoadingState variant="table" label="Cargando documentos…" /> : null}
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
              status: statusFilter || undefined,
            })}
            onClear={() => setSearchParams({})}
          >
            <div>
              <Label htmlFor="status-filter">Estado</Label>
              <Select
                id="status-filter"
                value={statusFilter ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) setSearchParams({});
                  else setSearchParams({ status: v });
                }}
              >
                <option value="">Todos</option>
                <option value="draft">Borrador</option>
                <option value="published">Publicado</option>
              </Select>
            </div>
          </FilterPanel>

          {filtered.length === 0 ? (
            <EmptyState
              icon={statusFilter ? SearchX : FileText}
              title="Sin documentos"
              description="Crea un borrador o ajusta el filtro."
            />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Documento</TH>
                    <TH>Versión</TH>
                    <TH>Estado</TH>
                    <TH>Hash</TH>
                    <TH>Publicado</TH>
                    <TH className="text-end">Acciones</TH>
                  </TR>
                </THead>
                <TBody>
                  {visible.map((d) => (
                    <TR key={d.id}>
                      <TD label="Documento">
                        <EntityCell
                          icon={FileText}
                          tone={d.status === "published" ? "brand" : "muted"}
                          title={d.title}
                          subtitle={<span className="font-mono">{d.code}</span>}
                        />
                      </TD>
                      <TD label="Versión">
                        <Badge color="outline" className="font-mono">
                          v{d.version}
                        </Badge>
                      </TD>
                      <TD label="Estado">
                        <StatusBadge
                          status={d.status}
                          label={d.status === "published" ? "Publicado" : "Borrador"}
                        />
                      </TD>
                      <TD label="Hash">
                        <MutedText
                          as="span"
                          className="inline-flex items-center gap-1 font-mono text-theme-xs"
                          title={d.hash}
                        >
                          <Hash className="size-3 shrink-0" aria-hidden />
                          {shortHash(d.hash)}
                        </MutedText>
                      </TD>
                      <TD label="Publicado">
                        <MutedText as="span" className="whitespace-nowrap">
                          {formatDateTime(d.published_at)}
                        </MutedText>
                      </TD>
                      <TD actions>
                        <RowActions>
                          {d.status === "draft" ? (
                            <>
                              <ActionButton
                                size="icon-sm"
                                icon={Pencil}
                                label="Editar"
                                onClick={() => openEdit(d)}
                              />
                              <ActionButton
                                size="icon-sm"
                                variant="primary"
                                icon={Send}
                                label="Publicar"
                                onClick={() => setPublishConfirm(d)}
                              />
                            </>
                          ) : (
                            <ActionButton
                              size="icon-sm"
                              icon={Eye}
                              label="Ver"
                              onClick={() => {
                                setEditing(d);
                                setForm(fromDoc(d));
                                setFormError(null);
                                setDialogOpen(true);
                              }}
                            />
                          )}
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
        ariaLabel={
          editing
            ? editing.status === "draft"
              ? "Editar documento legal"
              : "Ver documento legal"
            : "Crear borrador legal"
        }
        size="xl"
      >
        <DialogHeader
          title={
            editing
              ? editing.status === "draft"
                ? "Editar borrador"
                : "Documento publicado"
              : "Crear borrador"
          }
          description={
            editing?.status === "published"
              ? "Inmutable: no se puede editar tras publicar."
              : "Markdown en body_md. Al publicar, body y hash quedan fijos."
          }
          onClose={() => setDialogOpen(false)}
        />
        <DialogBody>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="legal-code">Código</Label>
                <Input
                  id="legal-code"
                  value={form.code}
                  disabled={Boolean(editing)}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="privacy.es-PE"
                />
              </div>
              <div>
                <Label htmlFor="legal-version">Versión</Label>
                <Input
                  id="legal-version"
                  type="number"
                  min={1}
                  value={String(form.version)}
                  disabled={editing?.status === "published"}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      version: Number(e.target.value) || 1,
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="legal-title">Título</Label>
              <Input
                id="legal-title"
                value={form.title}
                disabled={editing?.status === "published"}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="legal-body">Cuerpo (markdown)</Label>
              <Textarea
                id="legal-body"
                value={form.body_md}
                disabled={editing?.status === "published"}
                onChange={(e) => setForm((f) => ({ ...f, body_md: e.target.value }))}
                rows={14}
                className="font-mono text-sm"
              />
            </div>
          </div>
          {formError ? <FieldError message={formError} /> : null}
        </DialogBody>
        <DialogFooter>
          <ActionButton
            size="default"
            icon={X}
            label={editing?.status === "published" ? "Cerrar" : "Cancelar"}
            onClick={() => setDialogOpen(false)}
          />
          {editing?.status !== "published" ? (
            <ActionButton
              size="default"
              variant="primary"
              icon={Save}
              label="Guardar"
              pending={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            />
          ) : null}
        </DialogFooter>
      </Dialog>

      <Dialog
        open={Boolean(publishConfirm)}
        onClose={() => setPublishConfirm(null)}
        ariaLabel="Confirmar publicación"
        size="sm"
      >
        <DialogHeader
          title="Publicar documento"
          description={
            publishConfirm
              ? `Se publicará ${publishConfirm.code} v${publishConfirm.version}. El body y hash quedarán inmutables. Orgs con versión previa deberán reaceptar.`
              : undefined
          }
          onClose={() => setPublishConfirm(null)}
        />
        <DialogFooter>
          <ActionButton
            size="default"
            icon={X}
            label="Cancelar"
            onClick={() => setPublishConfirm(null)}
          />
          <ActionButton
            size="default"
            variant="primary"
            icon={Send}
            label={publishMutation.isPending ? "Publicando…" : "Publicar"}
            pending={publishMutation.isPending}
            disabled={!publishConfirm}
            onClick={() => {
              if (publishConfirm) publishMutation.mutate(publishConfirm.id);
            }}
          />
        </DialogFooter>
      </Dialog>
    </div>
  );
}
