import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/shared/api/errors";
import { Button } from "@/shared/ui/components/button";
import { Dialog } from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";
import { ErrorState } from "@/shared/ui/ErrorState";

import { createOrgUser } from "../api";
import type { OrgRole, UserStatus } from "../types";
import { RolesMultiSelect } from "./RolesMultiSelect";

export function CreateUserDialog({
  open,
  onClose,
  roles,
}: {
  open: boolean;
  onClose: () => void;
  roles: OrgRole[];
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<UserStatus>("active");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createOrgUser,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["org-users"] });
      setEmail("");
      setName("");
      setPassword("");
      setStatus("active");
      setSelectedRoles([]);
      setError(null);
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError("No se pudo crear el usuario");
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selectedRoles.length < 1) {
      setError("Selecciona al menos un rol");
      return;
    }
    mutation.mutate({
      email,
      name,
      password,
      roles: selectedRoles,
      status,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title="Invitar / crear usuario">
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="space-y-1.5">
          <Label htmlFor="create-email">Email</Label>
          <Input
            id="create-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="create-name">Nombre</Label>
          <Input
            id="create-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="create-password">Contraseña temporal</Label>
          <Input
            id="create-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="create-status">Estado</Label>
          <Select
            id="create-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as UserStatus)}
          >
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </Select>
        </div>
        <RolesMultiSelect
          roles={roles}
          value={selectedRoles}
          onChange={setSelectedRoles}
        />
        {error ? <ErrorState title="Error" message={error} /> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Creando…" : "Crear"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
