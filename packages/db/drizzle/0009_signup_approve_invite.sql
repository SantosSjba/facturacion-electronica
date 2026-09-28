-- S14-APR: invite tokens + link signup → organization

CREATE TABLE invite_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX invite_tokens_token_hash_uidx ON invite_tokens (token_hash);
CREATE INDEX invite_tokens_user_idx ON invite_tokens (user_id);

ALTER TABLE signup_requests
  ADD COLUMN organization_id uuid REFERENCES organizations (id) ON DELETE SET NULL;
