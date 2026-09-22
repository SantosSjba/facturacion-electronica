import { Ban, Loader2 } from "lucide-react";

import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import { Badge } from "@/shared/ui/components/badge";
import { MutedText } from "@/shared/ui/components/muted-text";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";
import { cn } from "@/shared/ui/utils";

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
            <TD label="Nombre">
              <div className="font-medium text-gray-800 dark:text-white/90">
                {k.name}
              </div>
              {k.environmentConstraint ? (
                <MutedText as="span" className="text-theme-xs">
                  {k.environmentConstraint}
                </MutedText>
              ) : null}
            </TD>
            <TD label="Prefix">
              <code className="text-theme-xs">{k.keyPrefix}…</code>
            </TD>
            <TD label="Scopes">
              <div className="flex flex-wrap gap-1 max-md:justify-end">
                {k.scopes.map((s) => (
                  <Badge key={s} variant="outline">
                    {s}
                  </Badge>
                ))}
              </div>
            </TD>
            <TD label="Estado">
              <Badge variant={k.status === "active" ? "success" : "muted"}>
                {k.status}
              </Badge>
            </TD>
            <TD label="Último uso">
              <MutedText as="span">{formatDate(k.lastUsedAt)}</MutedText>
            </TD>
            <TD actions>
              {canManage && k.status === "active" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-label-sm"
                  aria-label="Revocar"
                  disabled={revokingId === k.id}
                  onClick={() => onRevoke(k.id)}
                >
                  {revokingId === k.id ? (
                    <Loader2 className={cn(buttonIconClassName, "animate-spin")} />
                  ) : (
                    <Ban className={buttonIconClassName} />
                  )}
                  <ButtonLabel>Revocar</ButtonLabel>
                </Button>
              ) : null}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
