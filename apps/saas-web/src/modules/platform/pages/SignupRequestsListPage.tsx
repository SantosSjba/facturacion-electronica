import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  EmptyState,
  ErrorState,
  FilterPanel,
  countActiveFilters,
  LoadingState,
  PageHeader,
  DEFAULT_PAGE_SIZE,
  Pagination,
  Badge,
  Input,
  Label,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@factosys/ui";

import { TextLink } from "@/shared/ui/components/text-link";

import { fetchSignupRequests, type SignupStatus } from "../api/signups";
import { signupStatusBadge } from "../lib/status-badges";

const STATUS_OPTIONS: Array<SignupStatus | ""> = [
  "",
  "received",
  "under_review",
  "approved",
  "rejected",
];

export function SignupRequestsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = (searchParams.get("status") ?? "") as SignupStatus | "";
  const q = searchParams.get("q") ?? "";
  const [qDraft, setQDraft] = useState(q);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => setQDraft(q), [q]);

  const query = useQuery({
    queryKey: ["signup-requests", status || null, q || null],
    queryFn: () =>
      fetchSignupRequests({
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

  const activeFilterCount = countActiveFilters({
    status: status || undefined,
    q: q.trim() || undefined,
  });

  return (
    <div>
      <PageHeader title="Solicitudes" description="Signup requests de la landing." />

      {query.isLoading ? <LoadingState variant="table" label="Cargando solicitudes…" /> : null}
      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Error al cargar"}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error ? (
        <div className="space-y-4">
          <FilterPanel
            activeCount={activeFilterCount}
            onClear={() => {
              setQDraft("");
              setSearchParams({});
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="status">Estado</Label>
                <Select
                  id="status"
                  value={status}
                  onChange={(e) => setFilter({ status: e.target.value })}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s || "all"} value={s}>
                      {s || "Todos"}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="q">Buscar</Label>
                <Input
                  id="q"
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                  onBlur={() => setFilter({ q: qDraft })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setFilter({ q: qDraft });
                  }}
                  placeholder="Empresa, RUC, email…"
                />
              </div>
            </div>
          </FilterPanel>

          {items.length === 0 ? (
            <EmptyState
              title="Sin solicitudes"
              description="No hay solicitudes con estos filtros."
            />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Empresa</TH>
                    <TH>RUC</TH>
                    <TH>Contacto</TH>
                    <TH>Plan</TH>
                    <TH>Estado</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {visible.map((row) => {
                    const badge = signupStatusBadge(row.status);
                    return (
                      <TR key={row.id}>
                        <TD className="font-medium">{row.company_name}</TD>
                        <TD>{row.ruc}</TD>
                        <TD>
                          <div>{row.contact_name}</div>
                          <div className="text-theme-xs text-gray-500">{row.contact_email}</div>
                        </TD>
                        <TD>{row.plan_code ?? "—"}</TD>
                        <TD>
                          <Badge color={badge.color}>{badge.label}</Badge>
                        </TD>
                        <TD>
                          <TextLink to={`/platform/signup-requests/${row.id}`}>Ver</TextLink>
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
