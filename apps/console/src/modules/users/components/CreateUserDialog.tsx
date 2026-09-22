import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/shared/api/errors";
import { Button } from "@/shared/ui/components/button";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select } from "@/shared/ui/components/select";
import { ErrorState } from "@/shared/ui/ErrorState";
import { FieldError } from "@/shared/ui/FieldError";

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
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    name?: string;
    password?: string;
    roles?: string;
  }>({});

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
    const nextErrors: typeof fieldErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      nextErrors.email = "Ingresa un correo electrónico válido";
    if (name.trim().length < 2) nextErrors.name = "Ingresa el nombre completo";
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
      nextErrors.password = "Usa al menos 8 caracteres, una letra y un número";
    if (selectedRoles.length < 1) nextErrors.roles = "Selecciona al menos un rol";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    mutation.mutate({
      email,
      name,
      password,
      roles: selectedRoles,
      status,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} ariaLabel="Invitar o crear usuario">
      <form onSubmit={(e) => void onSubmit(e)}>
        <DialogHeader
          title="Invitar / crear usuario"
          description="Configura sus datos de acceso y permisos iniciales."
          onClose={onClose}
        />
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="create-email">Email</Label>
            <Input
              id="create-email"
              type="email"
              required
              value={email}
              aria-invalid={Boolean(fieldErrors.email)}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FieldError message={fieldErrors.email} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-name">Nombre</Label>
            <Input
              id="create-name"
              required
              value={name}
              aria-invalid={Boolean(fieldErrors.name)}
              onChange={(e) => setName(e.target.value)}
            />
            <FieldError message={fieldErrors.name} />
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
              aria-invalid={Boolean(fieldErrors.password)}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FieldError message={fieldErrors.password} />
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
          <RolesMultiSelect roles={roles} value={selectedRoles} onChange={setSelectedRoles} />
          <FieldError message={fieldErrors.roles} />
          {error ? <ErrorState title="Error" message={error} /> : null}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Creando…" : "Crear"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
