import type { OrgUser } from "../types";
import { Badge } from "@/shared/ui/components/badge";
import { MutedText } from "@/shared/ui/components/muted-text";
import { TextLink } from "@/shared/ui/components/text-link";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function UsersTable({ users }: { users: OrgUser[] }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Email</TH>
          <TH>Nombre</TH>
          <TH>Roles</TH>
          <TH>Estado</TH>
          <TH>Último login</TH>
        </TR>
      </THead>
      <TBody>
        {users.map((u) => (
          <TR key={u.id}>
            <TD label="Email">
              <TextLink to={`/users/${u.id}`}>{u.email}</TextLink>
            </TD>
            <TD label="Nombre">{u.name}</TD>
            <TD label="Roles">
              <div className="flex flex-wrap gap-1 max-md:justify-end">
                {u.roles.map((r) => (
                  <Badge key={r} variant="outline">
                    {r}
                  </Badge>
                ))}
              </div>
            </TD>
            <TD label="Estado">
              <Badge variant={u.status === "active" ? "success" : "muted"}>
                {u.status}
              </Badge>
            </TD>
            <TD label="Último login">
              <MutedText as="span">{formatDate(u.lastLoginAt)}</MutedText>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
