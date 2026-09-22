-- migrate:0001_core_tables
-- Core schema per docs/planificacion/26-modelo-datos-postgres.md §6 steps 1–15.
-- RBAC (users/roles) deferred to S3-AUTH.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text,
  status text NOT NULL DEFAULT 'active',
  rate_limit_rpm integer,
  ip_allowlist jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_status_check CHECK (status IN ('active', 'suspended'))
);
CREATE UNIQUE INDEX organizations_slug_uidx ON organizations (slug) WHERE slug IS NOT NULL;

CREATE TABLE api_keys (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL,
  status text NOT NULL,
  environment_constraint text,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT api_keys_status_check CHECK (status IN ('active', 'revoked')),
  CONSTRAINT api_keys_env_constraint_check CHECK (
    environment_constraint IS NULL OR environment_constraint IN ('sandbox', 'production')
  )
);
CREATE UNIQUE INDEX api_keys_key_prefix_uidx ON api_keys (key_prefix);
CREATE INDEX api_keys_org_status_idx ON api_keys (organization_id, status);

CREATE TABLE companies (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  ruc char(11) NOT NULL,
  legal_name text NOT NULL,
  trade_name text,
  environment text NOT NULL DEFAULT 'sandbox',
  address jsonb,
  catalog_pin jsonb NOT NULL DEFAULT '{}'::jsonb,
  timezone text NOT NULL DEFAULT 'America/Lima',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_environment_check CHECK (environment IN ('sandbox', 'production')),
  CONSTRAINT companies_ruc_len_check CHECK (char_length(ruc) = 11)
);
CREATE UNIQUE INDEX companies_org_ruc_env_uidx ON companies (organization_id, ruc, environment);
CREATE INDEX companies_org_id_idx ON companies (organization_id, id);

CREATE TABLE credentials (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL,
  secret_ref text NOT NULL,
  public_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credentials_kind_check CHECK (kind IN ('certificate', 'sol', 'gre')),
  CONSTRAINT credentials_status_check CHECK (status IN ('active', 'expired', 'revoked', 'missing'))
);
CREATE UNIQUE INDEX credentials_company_kind_uidx ON credentials (company_id, kind);
CREATE INDEX credentials_org_company_idx ON credentials (organization_id, company_id);

CREATE TABLE document_series (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  document_type text NOT NULL,
  serie text NOT NULL,
  next_number bigint NOT NULL DEFAULT 1,
  padding integer NOT NULL DEFAULT 8,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_series_next_number_check CHECK (next_number >= 1),
  CONSTRAINT document_series_padding_check CHECK (padding >= 1)
);
CREATE UNIQUE INDEX document_series_company_type_serie_uidx
  ON document_series (company_id, document_type, serie);
CREATE INDEX document_series_org_company_idx ON document_series (organization_id, company_id);

CREATE TABLE documents (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  document_type text NOT NULL,
  serie text,
  number bigint,
  serie_number text,
  status text NOT NULL,
  environment text NOT NULL,
  issue_date date,
  currency char(3),
  customer_identity_type text,
  customer_identity_number text,
  customer_name text,
  totals jsonb,
  payload jsonb NOT NULL,
  payload_hash text NOT NULL,
  sunat_ticket text,
  sunat_response_code text,
  sunat_response_message text,
  ubl_profile text,
  ruleset_version text,
  related_document_id uuid REFERENCES documents (id) ON DELETE SET NULL,
  idempotency_key text,
  error jsonb,
  queued_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documents_status_check CHECK (
    status IN (
      'draft', 'validated', 'queued', 'sent', 'ticket_pending',
      'accepted', 'accepted_with_observation', 'rejected', 'failed', 'cancelled'
    )
  ),
  CONSTRAINT documents_environment_check CHECK (environment IN ('sandbox', 'production'))
);
CREATE UNIQUE INDEX documents_company_type_serie_number_uidx
  ON documents (company_id, document_type, serie, number) WHERE number IS NOT NULL;
CREATE UNIQUE INDEX documents_org_company_idempotency_uidx
  ON documents (organization_id, company_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX documents_org_company_created_idx ON documents (organization_id, company_id, created_at);
CREATE INDEX documents_org_company_status_idx ON documents (organization_id, company_id, status);
CREATE INDEX documents_company_ticket_idx ON documents (company_id, sunat_ticket) WHERE sunat_ticket IS NOT NULL;
CREATE INDEX documents_company_serie_number_idx ON documents (company_id, serie_number);

CREATE TABLE document_artifacts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  kind text NOT NULL,
  storage_backend text NOT NULL DEFAULT 's3',
  bucket text,
  object_key text,
  content_type text,
  sha256 text NOT NULL,
  size_bytes bigint NOT NULL,
  encryption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_artifacts_kind_check CHECK (
    kind IN ('request_json', 'xml_unsigned', 'xml_signed', 'zip', 'cdr_xml', 'pdf', 'other')
  ),
  CONSTRAINT document_artifacts_storage_check CHECK (storage_backend IN ('s3', 'db'))
);
CREATE UNIQUE INDEX document_artifacts_document_kind_uidx ON document_artifacts (document_id, kind);
CREATE INDEX document_artifacts_tenancy_idx ON document_artifacts (organization_id, company_id, document_id);

CREATE TABLE document_events (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  from_status text,
  detail text,
  source text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT document_events_source_check CHECK (source IN ('api', 'worker', 'sunat', 'system'))
);
CREATE INDEX document_events_document_at_idx ON document_events (document_id, at);
CREATE INDEX document_events_tenancy_at_idx ON document_events (organization_id, company_id, at);

CREATE TABLE idempotency_keys (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  key text NOT NULL,
  request_hash text NOT NULL,
  request_path text NOT NULL,
  status text NOT NULL,
  document_id uuid REFERENCES documents (id) ON DELETE SET NULL,
  response_code integer,
  response_body jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT idempotency_keys_status_check CHECK (status IN ('in_progress', 'completed', 'expired'))
);
CREATE UNIQUE INDEX idempotency_keys_org_company_key_uidx
  ON idempotency_keys (organization_id, company_id, key);
CREATE INDEX idempotency_keys_expires_idx ON idempotency_keys (expires_at);

CREATE TABLE webhook_endpoints (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies (id) ON DELETE SET NULL,
  url text NOT NULL,
  events text[] NOT NULL,
  status text NOT NULL DEFAULT 'active',
  secret_hash text NOT NULL,
  secret_encrypted bytea,
  secret_hint char(4) NOT NULL,
  consecutive_failures integer NOT NULL DEFAULT 0,
  disabled_at timestamptz,
  last_success_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_endpoints_status_check CHECK (status IN ('active', 'disabled'))
);
CREATE INDEX webhook_endpoints_org_status_idx ON webhook_endpoints (organization_id, status);

CREATE TABLE webhook_deliveries (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  endpoint_id uuid NOT NULL REFERENCES webhook_endpoints (id) ON DELETE CASCADE,
  document_id uuid REFERENCES documents (id) ON DELETE SET NULL,
  event_type text NOT NULL,
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  http_status integer,
  response_excerpt text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_deliveries_status_check CHECK (status IN ('pending', 'success', 'failed'))
);
CREATE UNIQUE INDEX webhook_deliveries_endpoint_idempotency_uidx
  ON webhook_deliveries (endpoint_id, idempotency_key);
CREATE INDEX webhook_deliveries_pending_idx ON webhook_deliveries (status, next_attempt_at)
  WHERE status = 'pending';
CREATE INDEX webhook_deliveries_document_idx ON webhook_deliveries (document_id);
CREATE INDEX webhook_deliveries_endpoint_created_idx ON webhook_deliveries (endpoint_id, created_at);

CREATE TABLE catalog_versions (
  id uuid PRIMARY KEY,
  kind text NOT NULL,
  version text NOT NULL,
  source_filename text,
  source_sha256 text NOT NULL,
  effective_from date,
  effective_to date,
  is_default boolean NOT NULL DEFAULT false,
  artifact_path text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_versions_kind_check CHECK (
    kind IN ('ruleset_excel', 'anexo_vii', 'rs340', 'codigos_retorno', 'ubigeo', 'other')
  )
);
CREATE UNIQUE INDEX catalog_versions_kind_version_uidx ON catalog_versions (kind, version);
CREATE UNIQUE INDEX catalog_versions_kind_default_uidx ON catalog_versions (kind) WHERE is_default = true;

CREATE TABLE catalog_items (
  id uuid PRIMARY KEY,
  catalog_version_id uuid NOT NULL REFERENCES catalog_versions (id) ON DELETE CASCADE,
  catalog_code text NOT NULL,
  item_code text NOT NULL,
  description text,
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX catalog_items_version_code_item_uidx
  ON catalog_items (catalog_version_id, catalog_code, item_code);
CREATE INDEX catalog_items_version_code_idx ON catalog_items (catalog_version_id, catalog_code);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations (id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies (id) ON DELETE SET NULL,
  actor_type text NOT NULL,
  actor_id text,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  ip inet,
  user_agent text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_events_actor_type_check CHECK (
    actor_type IN ('api_key', 'system', 'worker', 'support')
  )
);
CREATE INDEX audit_events_org_created_idx ON audit_events (organization_id, created_at);
CREATE INDEX audit_events_resource_idx ON audit_events (resource_type, resource_id);
