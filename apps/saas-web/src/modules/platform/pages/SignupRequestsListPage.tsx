import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Eye, Hash, Layers, Mail, SearchX } from "lucide-react";

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

import { fetchSignupRequests, type SignupStatus } from "../api/signups";
import { signupStatusBadge } from "../lib/status-badges";

const STATUS_OPTIONS: (SignupStatus | "")[] = [
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
      <PageHeader
        icon={ClipboardList}
        title="Solicitudes"
        description="Solicitudes de registro recibidas desde la landing."
      />

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
                      {s ? signupStatusBadge(s).label : "Todos"}
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
              icon={activeFilterCount > 0 ? SearchX : ClipboardList}
              title="Sin solicitudes"
              description="No hay solicitudes con estos filtros."
            />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Empresa</TH>
                    <TH>Contacto</TH>
                    <TH>Plan</TH>
                    <TH>Estado</TH>
                    <TH>Recibida</TH>
                    <TH className="text-end">Acciones</TH>
                  </TR>
                </THead>
                <TBody>
                  {visible.map((row) => {
                    const badge = signupStatusBadge(row.status);
                    const to = `/platform/signup-requests/${row.id}`;
                    return (
                      <TR key={row.id}>
                        <TD label="Empresa">
                          <EntityCell
                            initials={initialsOf(row.company_name, row.ruc)}
                            title={<TextLink to={to}>{row.company_name}</TextLink>}
                            subtitle={
                              <>
                                <Hash aria-hidden />
                                <span className="font-mono">{row.ruc}</span>
                              </>
                            }
                          />
                        </TD>
                        <TD label="Contacto">
                          <div className="min-w-0">
                            <div className="text-gray-800 dark:text-white/90">
                              {row.contact_name}
                            </div>
                            <MutedText
                              as="span"
                              className="mt-0.5 flex items-center gap-1 text-theme-xs max-md:justify-end"
                            >
                              <Mail className="size-3 shrink-0" aria-hidden />
                              <span className="break-all">{row.contact_email}</span>
                            </MutedText>
                          </div>
                        </TD>
                        <TD label="Plan">
                          {row.plan_code ? (
                            <Badge color="outline">
                              <Layers className="size-3 shrink-0" aria-hidden />
                              {row.plan_code}
                            </Badge>
                          ) : (
                            <MutedText as="span">—</MutedText>
                          )}
                        </TD>
                        <TD label="Estado">
                          <StatusBadge status={row.status} label={badge.label} />
                        </TD>
                        <TD label="Recibida">
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
