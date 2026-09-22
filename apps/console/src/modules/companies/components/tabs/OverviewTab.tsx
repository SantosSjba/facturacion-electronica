import { Link, useOutletContext } from "react-router-dom";

import { Badge } from "@/shared/ui/components/badge";
import { useSession } from "@/shared/auth/session-context";

import type { Company } from "../../types";

export function OverviewTab() {
  const { company } = useOutletContext<{ company: Company }>();
  const { hasPermission } = useSession();
  const canWrite = hasPermission("companies:write");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="RUC" value={company.ruc} />
      <Field label="Razón social" value={company.legal_name} />
      <Field label="Ambiente" value={company.environment} />
      <div>
        <p className="text-xs uppercase text-[var(--muted-foreground)]">
          Certificado
        </p>
        <Badge
          variant={company.certificate_status === "active" ? "success" : "muted"}
        >
          {company.certificate_status}
        </Badge>
      </div>
      <Field
        label="SOL configurado"
        value={company.sol_configured ? "sí" : "no"}
      />
      <Field
        label="GRE configurado"
        value={company.gre_configured ? "sí" : "no"}
      />
      <Field
        label="Ruleset pin"
        value={company.catalog_pin?.ruleset ?? "—"}
      />
      <Field
        label="Creado"
        value={new Date(company.created_at).toLocaleString()}
      />
      {canWrite ? (
        <div className="sm:col-span-2">
          <Link
            to={`/companies/${company.id}/edit`}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            Editar metadatos
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-[var(--muted-foreground)]">{label}</p>
      <p className="text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}
