import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { MutedText } from "@/shared/ui/components/muted-text";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";

import type { ApiKey } from "../types";

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function ApiKeysTable({
  keys,
  canManage,
  onRevoke,
  revokingId,
}: {
  keys: ApiKey[];
  canManage: boolean;
  onRevoke: (id: string) => void;
  revokingId?: string | null;
}) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Nombre</TH>
          <TH>Prefix</TH>
          <TH>Scopes</TH>
          <TH>Estado</TH>
          <TH>Último uso</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {keys.map((k) => (
          <TR key={k.id}>
            <TD>
              <div className="font-medium text-gray-800 dark:text-white/90">
                {k.name}
              </div>
              {k.environmentConstraint ? (
                <MutedText as="span" className="text-theme-xs">
                  {k.environmentConstraint}
                </MutedText>
              ) : null}
            </TD>
            <TD>
              <code className="text-theme-xs">{k.keyPrefix}…</code>
            </TD>
            <TD>
              <div className="flex flex-wrap gap-1">
                {k.scopes.map((s) => (
                  <Badge key={s} variant="outline">
                    {s}
                  </Badge>
                ))}
              </div>
            </TD>
            <TD>
              <Badge variant={k.status === "active" ? "success" : "muted"}>
                {k.status}
              </Badge>
            </TD>
            <TD>
              <MutedText as="span">{formatDate(k.lastUsedAt)}</MutedText>
            </TD>
            <TD className="text-end">
              {canManage && k.status === "active" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={revokingId === k.id}
                  onClick={() => onRevoke(k.id)}
                >
                  Revocar
                </Button>
              ) : null}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
