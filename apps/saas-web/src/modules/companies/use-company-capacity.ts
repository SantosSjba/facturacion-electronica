import { usePlanCapacity } from "@/shared/plan/use-plan-capacity";
export function useCompanyCapacity(enabled = true) {
  return usePlanCapacity("companies", enabled);
}
