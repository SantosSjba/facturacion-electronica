import { Link } from "react-router-dom";

import type { OrgUser } from "../types";
import { Badge } from "@/shared/ui/components/badge";
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
            <TD>
              <Link
                to={`/users/${u.id}`}
                className="font-medium text-[var(--primary)] hover:underline"
              >
                {u.email}
              </Link>
            </TD>
            <TD>{u.name}</TD>
            <TD>
              <div className="flex flex-wrap gap-1">
                {u.roles.map((r) => (
                  <Badge key={r} variant="outline">
                    {r}
                  </Badge>
                ))}
              </div>
            </TD>
            <TD>
              <Badge variant={u.status === "active" ? "success" : "muted"}>
                {u.status}
              </Badge>
            </TD>
            <TD className="text-[var(--muted-foreground)]">
              {formatDate(u.lastLoginAt)}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
