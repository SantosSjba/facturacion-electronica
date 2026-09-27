-- Soft-disable companies (active | disabled)

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS companies_status_check;

ALTER TABLE companies
  ADD CONSTRAINT companies_status_check CHECK (status IN ('active', 'disabled'));

CREATE INDEX IF NOT EXISTS companies_org_status_idx ON companies (organization_id, status);
