import { describe, expect, it } from "vitest";

import { buildDocumentObjectKey } from "./object-storage.keys";

describe("buildDocumentObjectKey", () => {
  it("follows doc 26 key convention", () => {
    expect(
      buildDocumentObjectKey({
        organizationId: "org-1",
        companyId: "co-1",
        documentId: "doc-1",
        kind: "xml",
        sha256: "abc123",
        ext: "xml",
      }),
    ).toBe("org/org-1/company/co-1/documents/doc-1/xml/abc123.xml");
  });

  it("strips leading dot from extension", () => {
    expect(
      buildDocumentObjectKey({
        organizationId: "o",
        companyId: "c",
        documentId: "d",
        kind: "pdf",
        sha256: "hash",
        ext: ".pdf",
      }),
    ).toMatch(/\.pdf$/);
  });
});
