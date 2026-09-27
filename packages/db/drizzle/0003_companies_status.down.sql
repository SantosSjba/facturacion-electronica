DROP INDEX IF EXISTS companies_org_status_idx;

ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS companies_status_check;

ALTER TABLE companies
  DROP COLUMN IF EXISTS status;
