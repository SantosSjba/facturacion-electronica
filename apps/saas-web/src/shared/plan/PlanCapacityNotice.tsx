import { Link } from "react-router-dom";
import type { usePlanCapacity } from "./use-plan-capacity";

export function PlanCapacityNotice({
  capacity,
  platform = false,
}: {
  capacity: ReturnType<typeof usePlanCapacity>;
  platform?: boolean;
}) {
  if (!capacity.message) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
      <span>{capacity.message}</span>
      {capacity.reached && !platform ? (
        <Link to="/app/plan" className="font-medium text-brand-500 hover:underline">
          Solicitar cambio de plan
        </Link>
      ) : null}
      {capacity.query.isError ? (
        <button
          type="button"
          onClick={() => void capacity.query.refetch()}
          className="font-medium text-brand-500 hover:underline"
        >
          Reintentar
        </button>
      ) : null}
    </div>
  );
}
