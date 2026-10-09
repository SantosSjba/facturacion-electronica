ALTER TABLE api_keys ADD COLUMN company_ids uuid[] NOT NULL DEFAULT '{}';
