import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "./components/button";

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const safePageCount = Math.max(1, pageCount);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-white/[0.03]"
      aria-label="Paginación"
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Mostrando <span className="font-medium text-gray-800 dark:text-white/90">{from}–{to}</span> de{" "}
        <span className="font-medium text-gray-800 dark:text-white/90">{total}</span>
      </p>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>
        <span className="min-w-24 text-center text-sm text-gray-500 dark:text-gray-400">
          Página {page} de {safePageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= safePageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Página siguiente"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight className="h-4 w-4" />
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
  onPrevious,
  onNext,
}: {
  page: number;
  canPrevious: boolean;
  canNext: boolean;
  itemCount: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <nav
      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-white/[0.03]"
      aria-label="Paginación de comprobantes"
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Página <span className="font-medium text-gray-800 dark:text-white/90">{page}</span> · {itemCount} comprobantes
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={!canPrevious} onClick={onPrevious}>
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!canNext} onClick={onNext}>
          Siguiente <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
