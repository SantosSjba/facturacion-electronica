import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog, DialogBody, DialogFooter, DialogHeader } from "@factosys/ui";
import { getErrorMessage } from "@/shared/api/errors";
import { assignApiKeyCompanies } from "../api";
import type { ApiKey } from "../types";
import { ApiKeyCompanies } from "./ApiKeyCompanies";

export function AssignApiKeyCompaniesDialog({
  apiKey,
  onClose,
}: {
  apiKey: ApiKey;
  onClose: () => void;
}) {
  const [ids, setIds] = useState(apiKey.companyIds);
  const [multi, setMulti] = useState(ids.length > 1);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => assignApiKeyCompanies(apiKey.id, ids, multi),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["api-keys"] });
      onClose();
    },
  });
  return (
    <Dialog open onClose={onClose} ariaLabel="Asignar empresas" size="md">
      <DialogHeader
        title={`Empresas de ${apiKey.name}`}
        description="El secreto se conserva. El cambio de acceso se aplica inmediatamente."
        onClose={onClose}
      />
      <DialogBody className="space-y-3">
        <ApiKeyCompanies ids={ids} multi={multi} onChange={setIds} onMultiChange={setMulti} />
        {mutation.error ? <p role="alert">{getErrorMessage(mutation.error)}</p> : null}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={!ids.length || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
