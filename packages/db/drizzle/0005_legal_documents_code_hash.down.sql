DROP INDEX IF EXISTS legal_documents_code_version_uidx;

ALTER TABLE legal_documents DROP COLUMN IF EXISTS hash;

ALTER TABLE legal_documents RENAME COLUMN code TO slug;

CREATE UNIQUE INDEX legal_documents_slug_version_uidx ON legal_documents (slug, version);
