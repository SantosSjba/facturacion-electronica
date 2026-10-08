export function environmentLabel(value: string): string {
  return (
    ({ sandbox: "Pruebas", production: "Producción" } as Record<string, string>)[value] ??
    "Ambiente desconocido"
  );
}

export function certificateLabel(value: string): string {
  return (
    (
      {
        missing: "Sin certificado",
        active: "Vigente",
        expired: "Vencido",
        revoked: "Revocado",
      } as Record<string, string>
    )[value] ?? "Estado desconocido"
  );
}

export function statusLabel(value: string): string {
  return (
    (
      {
        active: "Activo",
        disabled: "Desactivado",
        revoked: "Revocado",
        trialing: "En prueba",
        canceled: "Cancelado",
        cancelled: "Cancelado",
        suspended: "Suspendido",
        pending: "Pendiente",
        acknowledged: "En revisión",
        closed: "Cerrado",
        draft: "Borrador",
        published: "Publicado",
        queued: "En cola",
        sent: "Enviado",
        delivered: "Entregado",
        failed: "Fallido",
        retrying: "Reintentando",
        success: "Correcto",
      } as Record<string, string>
    )[value] ?? "Estado desconocido"
  );
}
