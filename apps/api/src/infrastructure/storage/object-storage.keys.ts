/**
 * S3 object key conventions (doc 26 §5).
 */
export function buildDocumentObjectKey(input: {
  organizationId: string;
  companyId: string;
  documentId: string;
  kind: string;
  sha256: string;
  ext: string;
}): string {
  const ext = input.ext.replace(/^\./, "");
  return [
    "org",
    input.organizationId,
    "company",
    input.companyId,
    "documents",
    input.documentId,
    input.kind,
    `${input.sha256}.${ext}`,
  ].join("/");
}
