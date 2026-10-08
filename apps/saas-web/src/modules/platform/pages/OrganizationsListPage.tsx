import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AtSign, Building2, Eye, Layers, SearchX } from "lucide-react";

import {
  EmptyState,
  ErrorState,
  FilterPanel,
  countActiveFilters,
  LoadingState,
  PageHeader,
  DEFAULT_PAGE_SIZE,
  Pagination,
  EntityCell,
  Input,
  Label,
  MutedText,
  RowActions,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  initialsOf,
} from "@factosys/ui";

import { ActionLink } from "@/shared/ui/components/action-link";
import { TextLink } from "@/shared/ui/components/text-link";
import { formatDateTime } from "@/shared/ui/display-labels";
import { StatusBadge } from "@/shared/ui/status-badge";

import { fetchOrganizations, type OrgStatus } from "../api/orgs";
import { orgStatusBadge } from "../lib/status-badges";

export function OrganizationsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = (searchParams.get("status") ?? "") as OrgStatus | "";
  const q = searchParams.get("q") ?? "";
  const [qDraft, setQDraft] = useState(q);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => setQDraft(q), [q]);

  const query = useQuery({
    queryKey: ["organizations", status || null, q || null],
    queryFn: () =>
      fetchOrganizations({
        status: status || undefined,
        q: q.trim() || undefined,
      }),
  });

  const items = query.data?.items ?? [];
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const visible = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  useEffect(() => setPage(1), [status, q, pageSize]);

  function setFilter(next: { status?: string; q?: string }) {
    const params = new URLSearchParams();
    const s = next.status !== undefined ? next.status : status;
    const queryText = next.q !== undefined ? next.q : q;
    if (s) params.set("status", s);
    if (queryText.trim()) params.set("q", queryText.trim());
    setSearchParams(params);
  }

  return (
    <div>
      <PageHeader
        icon={Building2}
        title="Organizaciones"
        description="Tenants SaaS (excluye org plataforma)."
      />

      {query.isLoading ? <LoadingState variant="table" label="Cargando organizaciones…" /> : null}
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
              status: status || undefined,
              q: q.trim() || undefined,
            })}
            onClear={() => {
              setQDraft("");
              setSearchParams({});
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="org-status">Estado</Label>
                <Select
                  id="org-status"
                  value={status}
                  onChange={(e) => setFilter({ status: e.target.value })}
                >
                  <option value="">Todos</option>
                  <option value="active">Activa</option>
                  <option value="suspended">Suspendida</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="org-q">Buscar</Label>
                <Input
                  id="org-q"
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                  onBlur={() => setFilter({ q: qDraft })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setFilter({ q: qDraft });
                  }}
                  placeholder="Nombre o slug…"
                />
              </div>
            </div>
          </FilterPanel>

          {items.length === 0 ? (
            <EmptyState
              icon={status || q ? SearchX : Building2}
              title="Sin organizaciones"
              description="No hay tenants con estos filtros."
            />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Organización</TH>
                    <TH>Plan</TH>
                    <TH>Estado</TH>
                    <TH>Creada</TH>
                    <TH className="text-end">Acciones</TH>
                  </TR>
                </THead>
                <TBody>
                  {visible.map((row) => {
                    const badge = orgStatusBadge(row.status);
                    const to = `/platform/organizations/${row.id}`;
                    return (
                      <TR key={row.id}>
                        <TD label="Organización">
                          <EntityCell
                            initials={initialsOf(row.name)}
                            tone={row.status === "active" ? "brand" : "muted"}
                            title={<TextLink to={to}>{row.name}</TextLink>}
                            subtitle={
                              row.slug ? (
                                <>
                                  <AtSign aria-hidden />
                                  <span className="font-mono">{row.slug}</span>
                                </>
                              ) : null
                            }
                          />
                        </TD>
                        <TD label="Plan">
                          {row.current_plan ? (
                            <span className="inline-flex items-center gap-1.5 text-gray-800 dark:text-white/90">
                              <Layers className="size-3.5 shrink-0 text-gray-400" aria-hidden />
                              {row.current_plan.plan_name}
                              <span className="font-mono text-theme-xs text-gray-500 dark:text-gray-400">
                                {row.current_plan.plan_code}
                              </span>
                            </span>
                          ) : (
                            <MutedText as="span">Sin plan</MutedText>
                          )}
                        </TD>
                        <TD label="Estado">
                          <StatusBadge status={row.status} label={badge.label} />
                        </TD>
                        <TD label="Creada">
                          <MutedText as="span" className="whitespace-nowrap">
                            {formatDateTime(row.created_at)}
                          </MutedText>
                        </TD>
                        <TD actions>
                          <RowActions>
                            <ActionLink size="icon-sm" to={to} icon={Eye} label="Ver detalle" />
                          </RowActions>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
              <Pagination
                page={page}
                pageCount={pageCount}
                total={items.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
