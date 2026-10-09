DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM documents WHERE document_type IN ('20','40','RR')) THEN
    RAISE EXCEPTION 'Cannot remove tax-agent support while fiscal history exists';
  END IF;
END $$;
DROP INDEX documents_tax_agent_ledger_idx;
ALTER TABLE companies DROP COLUMN tax_agent_settings;
