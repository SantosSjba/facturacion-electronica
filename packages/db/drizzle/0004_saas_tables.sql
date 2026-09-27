-- S12-API: SaaS scaffold tables (plans, signup, legal, notifications)

CREATE TABLE plans (
  id uuid PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  price_monthly_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PEN',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plans_currency_len CHECK (char_length(currency) = 3)
);

CREATE UNIQUE INDEX plans_code_uidx ON plans (code);

CREATE TABLE org_plans (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'trialing',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_plans_status_check CHECK (status IN ('trialing', 'active', 'canceled'))
);

CREATE INDEX org_plans_org_idx ON org_plans (organization_id);

CREATE TABLE signup_requests (
  id uuid PRIMARY KEY,
  company_name text NOT NULL,
  ruc text NOT NULL,
  contact_email citext NOT NULL,
  contact_name text NOT NULL,
  plan_code text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signup_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX signup_requests_status_idx ON signup_requests (status);

CREATE TABLE legal_documents (
  id uuid PRIMARY KEY,
  slug text NOT NULL,
  version integer NOT NULL,
  title text NOT NULL,
  body_md text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_documents_status_check CHECK (status IN ('draft', 'published'))
);

CREATE UNIQUE INDEX legal_documents_slug_version_uidx ON legal_documents (slug, version);

CREATE TABLE legal_acceptances (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  legal_document_id uuid NOT NULL REFERENCES legal_documents (id) ON DELETE RESTRICT,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text
);

CREATE INDEX legal_acceptances_org_idx ON legal_acceptances (organization_id);
CREATE INDEX legal_acceptances_doc_idx ON legal_acceptances (legal_document_id);

CREATE TABLE notification_templates (
  id uuid PRIMARY KEY,
  code text NOT NULL,
  channel text NOT NULL,
  subject text NOT NULL,
  body_md text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_templates_channel_check CHECK (channel IN ('email', 'in_app'))
);

CREATE UNIQUE INDEX notification_templates_code_uidx ON notification_templates (code);

CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations (id) ON DELETE CASCADE,
  user_id uuid REFERENCES users (id) ON DELETE CASCADE,
  template_code text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT notifications_status_check CHECK (status IN ('pending', 'sent', 'failed'))
);

CREATE INDEX notifications_org_idx ON notifications (organization_id);
CREATE INDEX notifications_user_idx ON notifications (user_id);
