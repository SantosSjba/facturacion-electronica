-- migrate-down:0001_core_tables
DROP TABLE IF EXISTS audit_events;
DROP TABLE IF EXISTS catalog_items;
DROP TABLE IF EXISTS catalog_versions;
DROP TABLE IF EXISTS webhook_deliveries;
DROP TABLE IF EXISTS webhook_endpoints;
DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS document_events;
DROP TABLE IF EXISTS document_artifacts;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS document_series;
DROP TABLE IF EXISTS credentials;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS organizations;
-- Keep pgcrypto; other extensions/apps may use it.
