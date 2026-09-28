-- S14-PLAN: price_display + max_* limits on plans

ALTER TABLE plans ADD COLUMN price_display text NOT NULL DEFAULT '';
ALTER TABLE plans ADD COLUMN max_companies integer NOT NULL DEFAULT 1;
ALTER TABLE plans ADD COLUMN max_users integer NOT NULL DEFAULT 2;
ALTER TABLE plans ADD COLUMN max_documents_per_month integer NOT NULL DEFAULT 100;
ALTER TABLE plans ADD COLUMN max_api_keys integer NOT NULL DEFAULT 1;

ALTER TABLE plans
  ADD CONSTRAINT plans_max_companies_nonneg CHECK (max_companies >= 0);
ALTER TABLE plans
  ADD CONSTRAINT plans_max_users_nonneg CHECK (max_users >= 0);
ALTER TABLE plans
  ADD CONSTRAINT plans_max_documents_per_month_nonneg CHECK (max_documents_per_month >= 0);
ALTER TABLE plans
  ADD CONSTRAINT plans_max_api_keys_nonneg CHECK (max_api_keys >= 0);
