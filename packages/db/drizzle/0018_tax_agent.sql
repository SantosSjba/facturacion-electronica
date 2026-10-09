ALTER TABLE companies ADD COLUMN tax_agent_settings jsonb NOT NULL DEFAULT '{"retention":false,"perception_regimes":[]}';
CREATE INDEX documents_tax_agent_ledger_idx ON documents(company_id, document_type) WHERE document_type IN ('20','40','RR');
