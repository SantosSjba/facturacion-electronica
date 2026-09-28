-- migrate:0013_org_exports
CREATE TABLE IF NOT EXISTS org_exports (
  id uuid PRIMARY KEY NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  object_key text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT org_exports_status_check CHECK (
    status IN ('queued', 'processing', 'ready', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS org_exports_org_idx ON org_exports (organization_id);
CREATE INDEX IF NOT EXISTS org_exports_status_idx ON org_exports (status);
