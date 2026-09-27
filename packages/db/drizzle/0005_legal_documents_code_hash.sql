-- S12-LEGAL: align legal_documents with ticket fields (code, hash)
-- Hash values for existing rows are placeholders; app recomputes on write.

DROP INDEX IF EXISTS legal_documents_slug_version_uidx;

ALTER TABLE legal_documents RENAME COLUMN slug TO code;

ALTER TABLE legal_documents ADD COLUMN hash text NOT NULL DEFAULT '';

ALTER TABLE legal_documents ALTER COLUMN hash DROP DEFAULT;

CREATE UNIQUE INDEX legal_documents_code_version_uidx ON legal_documents (code, version);
