import { useState } from "react";
import { FileCheck, FileCode, FileText, Loader2 } from "lucide-react";

import {
  Button,
  ButtonLabel,
  buttonIconClassName,
} from "@/shared/ui/components/button";

import { downloadDocumentArtifact } from "../api";

const ARTIFACT_META = {
  xml: { label: "XML", Icon: FileCode },
  cdr: { label: "CDR", Icon: FileCheck },
  pdf: { label: "PDF", Icon: FileText },
} as const;

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
        {(["xml", "cdr", "pdf"] as const).map((kind) => {
          const { label, Icon } = ARTIFACT_META[kind];
          const loading = busy === kind;
          return (
            <Button
              key={kind}
              type="button"
              variant="outline"
              size="icon-label-sm"
              aria-label={loading ? `Descargando ${label}` : label}
              data-testid={`artifact-${kind}`}
              disabled={busy !== null}
              onClick={() => void onDownload(kind)}
            >
              {loading ? (
                <Loader2 className={`${buttonIconClassName} animate-spin`} />
              ) : (
                <Icon className={buttonIconClassName} />
              )}
              <ButtonLabel>{loading ? "Descargando…" : label}</ButtonLabel>
            </Button>
          );
        })}
      </div>
      {error ? (
        <p className="text-sm text-error-600 dark:text-error-500">{error}</p>
      ) : null}
    </div>
  );
}
