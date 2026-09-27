import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleOff,
  Loader2,
  Mail,
  Pencil,
  Power,
  Shield,
  UserRound,
} from "lucide-react";

import { useSession } from "@/shared/auth/session-context";
import { Badge } from "@/shared/ui/components/badge";
import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/shared/ui/components/dialog";
import { MutedText } from "@/shared/ui/components/muted-text";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/components/table";
import { cn } from "@/shared/ui/utils";

import { patchOrgUser } from "../api";
import type { OrgUser, UserStatus } from "../types";

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function initials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function UsersTable({
  users,
  onEdit,
}: {
  users: OrgUser[];
  onEdit: (user: OrgUser) => void;
}) {
  const { hasPermission, user: sessionUser } = useSession();
  const canWrite = hasPermission("users:write");
  const qc = useQueryClient();
  const [pending, setPending] = useState<OrgUser | null>(null);

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      patchOrgUser(id, { status }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["org-users"] });
      setPending(null);
    },
  });

  return (
    <>
      <Table>
        <THead>
          <TR>
            <TH>Usuario</TH>
            <TH>Roles</TH>
            <TH>Estado</TH>
            <TH>Último login</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {users.map((u) => {
            const active = u.status === "active";
            const isSelf = sessionUser?.id === u.id;
            return (
              <TR key={u.id}>
                <TD label="Usuario">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full text-theme-xs font-semibold",
                        active
                          ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                          : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
                      )}
                      aria-hidden
                    >
                      {initials(u.name, u.email)}
                    </span>
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="block truncate text-left text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                        onClick={() => onEdit(u)}
                      >
                        {u.name || "Sin nombre"}
                      </button>
                      <MutedText
                        as="span"
                        className="mt-0.5 flex items-center gap-1 truncate text-theme-xs"
                      >
                        <Mail className="size-3 shrink-0" aria-hidden />
                        {u.email}
                      </MutedText>
                    </div>
                  </div>
                </TD>
                <TD label="Roles">
                  <div className="flex flex-wrap gap-1 max-md:justify-end">
                    {u.roles.length === 0 ? (
                      <MutedText as="span">Sin roles</MutedText>
                    ) : (
                      u.roles.map((r) => (
                        <Badge key={r} variant="outline" className="gap-1">
                          <Shield className="size-3" aria-hidden />
                          {r}
                        </Badge>
                      ))
                    )}
                  </div>
                </TD>
                <TD label="Estado">
                  <Badge
                    variant={active ? "success" : "muted"}
                    className="gap-1"
                  >
                    {active ? (
                      <CheckCircle2 className="size-3" aria-hidden />
                    ) : (
                      <CircleOff className="size-3" aria-hidden />
                    )}
                    {active ? "Activo" : "Deshabilitado"}
                  </Badge>
                </TD>
                <TD label="Último login">
                  <MutedText as="span">{formatDate(u.lastLoginAt)}</MutedText>
                </TD>
                <TD actions>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {canWrite && !isSelf ? (
                      <Button
                        type="button"
                        size="icon-label-sm"
                        variant="outline"
                        aria-label={active ? "Deshabilitar" : "Reactivar"}
                        onClick={() => setPending(u)}
                      >
                        <Power className={buttonIconClassName} />
                        <ButtonLabel>
                          {active ? "Deshabilitar" : "Reactivar"}
                        </ButtonLabel>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="icon-label-sm"
                      variant="outline"
                      aria-label={canWrite ? "Editar usuario" : "Ver usuario"}
                      onClick={() => onEdit(u)}
                    >
                      {canWrite ? (
                        <Pencil className={buttonIconClassName} />
                      ) : (
                        <UserRound className={buttonIconClassName} />
                      )}
                      <ButtonLabel>{canWrite ? "Editar" : "Ver"}</ButtonLabel>
                    </Button>
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <Dialog
        open={Boolean(pending)}
        onClose={() => {
          if (!mutation.isPending) setPending(null);
        }}
        ariaLabel="Confirmar estado de usuario"
        size="sm"
      >
        <DialogHeader
          title={
            pending?.status === "active"
              ? "Deshabilitar usuario"
              : "Reactivar usuario"
          }
          description={
            pending?.status === "active"
              ? "No podrá iniciar sesión hasta que lo reactives."
              : "El usuario podrá volver a iniciar sesión."
          }
          onClose={() => {
            if (!mutation.isPending) setPending(null);
          }}
        />
        <DialogBody>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {pending?.name}{" "}
            <span className="text-theme-xs text-gray-500">({pending?.email})</span>
          </p>
          {mutation.error ? (
            <p className="mt-2 text-sm text-error-600 dark:text-error-500">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "No se pudo actualizar"}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => setPending(null)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || !pending}
            onClick={() => {
              if (!pending) return;
              mutation.mutate({
                id: pending.id,
                status: pending.status === "active" ? "disabled" : "active",
              });
            }}
          >
            {mutation.isPending ? (
              <Loader2 className={`${buttonIconClassName} animate-spin`} />
            ) : (
              <Power className={buttonIconClassName} />
            )}
            <ButtonLabel>
              {pending?.status === "active" ? "Deshabilitar" : "Reactivar"}
            </ButtonLabel>
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
