import { Pencil } from "lucide-react";
import { useOutletContext } from "react-router-dom";

import { Badge } from "@/shared/ui/components/badge";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import { MutedText } from "@/shared/ui/components/muted-text";
import { useSession } from "@/shared/auth/session-context";

import type { Company } from "../../types";

export function OverviewTab() {
  const { company, onEdit } = useOutletContext<{
    company: Company;
    onEdit?: () => void;
  }>();
  const { hasPermission } = useSession();
  const canWrite = hasPermission("companies:write");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="RUC" value={company.ruc} />
      <Field label="Razón social" value={company.legal_name} />
      <Field label="Ambiente" value={company.environment} />
      <div>
        <MutedText className="text-xs uppercase">Certificado</MutedText>
        <Badge
          variant={
            company.certificate_status === "active" ? "success" : "muted"
          }
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
      <Field label="Ruleset pin" value={company.catalog_pin?.ruleset ?? "—"} />
      <Field
        label="Creado"
        value={new Date(company.created_at).toLocaleString()}
      />
      {canWrite && onEdit ? (
        <div className="sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            size="icon-label-sm"
            aria-label="Editar metadatos"
            onClick={onEdit}
          >
            <Pencil className={buttonIconClassName} />
            <ButtonLabel>Editar metadatos</ButtonLabel>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <MutedText className="text-xs uppercase">{label}</MutedText>
      <p className="text-sm font-medium text-gray-800 dark:text-white/90">
        {value}
      </p>
    </div>
  );
}
