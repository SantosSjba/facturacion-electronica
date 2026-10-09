CREATE TABLE document_deliveries (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 recipient text NOT NULL, request_key text NOT NULL, request_hash text NOT NULL,
 status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','queued','preparing','sending','retrying','sent','unknown','failed','expired')),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0), provider_message_id text, error text,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX document_delivery_request_uidx ON document_deliveries(organization_id,document_id,request_key,recipient);
CREATE INDEX document_delivery_status_idx ON document_deliveries(status,updated_at);
CREATE TABLE document_shares (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 token_hash text NOT NULL, allowed_artifacts jsonb NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX document_shares_hash_uidx ON document_shares(token_hash);
CREATE INDEX document_shares_doc_idx ON document_shares(organization_id,document_id);
INSERT INTO permissions(id,code,description) VALUES
 ('00000000-0000-4000-8000-000000000401','documents:deliver','Deliver fiscal documents to recipients'),
 ('00000000-0000-4000-8000-000000000402','documents:share','Create and revoke document shares') ON CONFLICT(code) DO NOTHING;
INSERT INTO role_permissions(role_id,permission_id)
 SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code IN ('owner','admin','operator') AND p.code IN ('documents:deliver','documents:share') ON CONFLICT DO NOTHING;
