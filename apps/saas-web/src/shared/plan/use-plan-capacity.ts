import { useQuery } from "@tanstack/react-query";
import { fetchOrgPlan, type OrgPlanMe } from "@/modules/app/api/plan";
import { apiRequest } from "@/shared/api/http-client";
import { useSession } from "@/shared/auth/session-context";

export type PlanResource = "companies" | "users" | "api_keys" | "documents_this_month";
const resources = {
  companies: { limit: "max_companies", label: "empresas" },
  users: { limit: "max_users", label: "usuarios" },
  api_keys: { limit: "max_api_keys", label: "API keys" },
  documents_this_month: { limit: "max_documents_per_month", label: "documentos este mes" },
} as const;
export function usePlanCapacity(resource: PlanResource, enabled = true, organizationId?: string) {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ["org-plan", organizationId ?? user?.organizationId],
    queryFn: () =>
      organizationId
        ? apiRequest<OrgPlanMe>(`/saas/organizations/${organizationId}/plan-usage`)
        : fetchOrgPlan(),
    enabled: enabled && Boolean(user),
    refetchInterval: 30_000,
  });
  const { limit: key, label } = resources[resource];
  const limit = query.data?.limits?.[key];
  const used = query.data?.usage[resource] ?? 0;
  const reached = limit != null && used >= limit;
  const blocked = !query.data || query.isError || reached;
  const message = query.isError
    ? `No se pudo verificar el cupo de ${label}.`
    : !query.data
      ? `Verificando el cupo de ${label}…`
      : reached
        ? `Alcanzaste el límite de tu plan: ${used} de ${limit} ${label}.`
        : limit != null
          ? `${used} de ${limit} ${label} en uso.`
          : null;
  return { query, blocked, reached, message, used, limit };
}
