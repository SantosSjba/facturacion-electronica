import { useState } from "react";

import { Button } from "@/shared/ui/components/button";

import { downloadDocumentArtifact } from "../api";

export function ArtifactButtons({ documentId }: { documentId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDownload(kind: "xml" | "cdr" | "pdf") {
    setError(null);
    setBusy(kind);
    try {
      await downloadDocumentArtifact(documentId, kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al descargar");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {(["xml", "cdr", "pdf"] as const).map((kind) => (
          <Button
            key={kind}
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() => void onDownload(kind)}
          >
            {busy === kind ? "Descargando…" : kind.toUpperCase()}
          </Button>
        ))}
      </div>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
