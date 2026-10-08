import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button, ButtonLabel, buttonIconClassName } from "./button";
import { Select } from "./select";

/** Default page size for administrative lists. */
export const DEFAULT_PAGE_SIZE = 10;

/** Allowed page sizes (10 → 50). */
export const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;

export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

function PageSizeSelect({
  pageSize,
  onPageSizeChange,
  id = "page-size",
}: {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  id?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex shrink-0 items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
    >
      <span className="hidden whitespace-nowrap sm:inline">Por página</span>
      <span className="whitespace-nowrap sm:hidden">Filas</span>
      <div className="relative">
        <Select
          id={id}
          value={pageSize}
          aria-label="Registros por página"
          className="h-9 min-w-18 ps-3 text-sm font-medium"
          onChange={(event) => {
            const next = Number(event.target.value);
            if (PAGE_SIZE_OPTIONS.includes(next as PageSizeOption)) {
              onPageSizeChange(next);
            }
          }}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </div>
    </label>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}) {
  const safePageCount = Math.max(1, pageCount);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      className="flex w-full flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between dark:border-gray-800 dark:bg-white/[0.03]"
      aria-label="Paginación"
    >
      <div className="flex w-full items-center justify-between gap-3 lg:w-auto lg:justify-start lg:gap-4">
        <p className="min-w-0 text-sm text-gray-500 dark:text-gray-400">
          Mostrando{" "}
          <span className="font-medium text-gray-800 dark:text-white/90">
            {from}–{to}
          </span>{" "}
          de <span className="font-medium text-gray-800 dark:text-white/90">{total}</span>
        </p>
        {onPageSizeChange ? (
          <PageSizeSelect
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              onPageSizeChange(size);
              if (page !== 1) onPageChange(1);
            }}
          />
        ) : null}
      </div>

      <div className="flex w-full items-center justify-between gap-2 lg:w-auto lg:justify-end lg:gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon-label-sm"
          className="max-lg:flex-1 max-lg:max-w-28"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className={buttonIconClassName} />
          <ButtonLabel>Anterior</ButtonLabel>
        </Button>
        <span className="shrink-0 px-1 text-center text-sm text-gray-500 dark:text-gray-400">
          <span className="sm:hidden">
            {page}/{safePageCount}
          </span>
          <span className="hidden sm:inline">
            Página {page} de {safePageCount}
          </span>
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-label-sm"
          className="max-lg:flex-1 max-lg:max-w-28"
          disabled={page >= safePageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Página siguiente"
        >
          <ButtonLabel>Siguiente</ButtonLabel>
          <ChevronRight className={buttonIconClassName} />
        </Button>
      </div>
    </nav>
  );
}

export function CursorPagination({
  page,
  canPrevious,
  canNext,
  itemCount,
  pageSize,
  onPrevious,
  onNext,
  onPageSizeChange,
}: {
  page: number;
  canPrevious: boolean;
  canNext: boolean;
  itemCount: number;
  pageSize?: number;
  onPrevious: () => void;
  onNext: () => void;
  onPageSizeChange?: (pageSize: number) => void;
}) {
  return (
    <nav
      className="flex w-full flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between dark:border-gray-800 dark:bg-white/[0.03]"
      aria-label="Paginación"
    >
      <div className="flex w-full items-center justify-between gap-3 lg:w-auto lg:justify-start lg:gap-4">
        <p className="min-w-0 text-sm text-gray-500 dark:text-gray-400">
          Página <span className="font-medium text-gray-800 dark:text-white/90">{page}</span>
          <span className="hidden sm:inline">
            {" "}
            · <span className="font-medium text-gray-800 dark:text-white/90">{itemCount}</span> en
            esta página
            {pageSize != null ? (
              <>
                {" "}
                (máx.{" "}
                <span className="font-medium text-gray-800 dark:text-white/90">{pageSize}</span>)
              </>
            ) : null}
          </span>
          <span className="sm:hidden">
            {" "}
            · <span className="font-medium text-gray-800 dark:text-white/90">{itemCount}</span>
          </span>
        </p>
        {onPageSizeChange && pageSize != null ? (
          <PageSizeSelect
            id="cursor-page-size"
            pageSize={pageSize}
            onPageSizeChange={onPageSizeChange}
          />
        ) : null}
      </div>

      <div className="flex w-full items-center justify-between gap-2 lg:w-auto lg:justify-end lg:gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon-label-sm"
          className="max-lg:flex-1 max-lg:max-w-28"
          disabled={!canPrevious}
          onClick={onPrevious}
          aria-label="Página anterior"
        >
          <ChevronLeft className={buttonIconClassName} />
          <ButtonLabel>Anterior</ButtonLabel>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-label-sm"
          className="max-lg:flex-1 max-lg:max-w-28"
          disabled={!canNext}
          onClick={onNext}
          aria-label="Página siguiente"
        >
          <ButtonLabel>Siguiente</ButtonLabel>
          <ChevronRight className={buttonIconClassName} />
        </Button>
      </div>
    </nav>
  );
}
