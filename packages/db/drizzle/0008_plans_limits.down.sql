ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_max_api_keys_nonneg;
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_max_documents_per_month_nonneg;
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_max_users_nonneg;
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_max_companies_nonneg;

ALTER TABLE plans DROP COLUMN IF EXISTS max_api_keys;
ALTER TABLE plans DROP COLUMN IF EXISTS max_documents_per_month;
ALTER TABLE plans DROP COLUMN IF EXISTS max_users;
ALTER TABLE plans DROP COLUMN IF EXISTS max_companies;
ALTER TABLE plans DROP COLUMN IF EXISTS price_display;
