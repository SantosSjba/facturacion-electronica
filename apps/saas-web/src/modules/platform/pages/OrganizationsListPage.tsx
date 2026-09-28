import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { FilterPanel, countActiveFilters } from "@/shared/ui/FilterPanel";
import { LoadingState } from "@/shared/ui/LoadingState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/shared/ui/Pagination";
import { Badge } from "@/shared/ui/components/badge";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";
import { TextLink } from "@/shared/ui/components/text-link";
import {
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/shared/ui/components/table";

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
        title="Organizaciones"
        description="Tenants SaaS (excluye org plataforma)."
      />

      {query.isLoading ? <LoadingState label="Cargando organizaciones…" /> : null}
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
              title="Sin organizaciones"
              description="No hay tenants con estos filtros."
            />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Nombre</TH>
                    <TH>Slug</TH>
                    <TH>Plan</TH>
                    <TH>Estado</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {visible.map((row) => {
                    const badge = orgStatusBadge(row.status);
                    return (
                      <TR key={row.id}>
                        <TD className="font-medium">{row.name}</TD>
                        <TD>{row.slug ?? "—"}</TD>
                        <TD>
                          {row.current_plan
                            ? `${row.current_plan.plan_name} (${row.current_plan.plan_code})`
                            : "—"}
                        </TD>
                        <TD>
                          <Badge color={badge.color}>{badge.label}</Badge>
                        </TD>
                        <TD>
                          <TextLink to={`/platform/organizations/${row.id}`}>
                            Ver
                          </TextLink>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
              <Pagination page={page} pageCount={pageCount} total={items.length} pageSize={pageSize}
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
