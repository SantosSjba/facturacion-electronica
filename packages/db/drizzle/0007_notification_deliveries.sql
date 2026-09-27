-- S13-NOTIF: notification_deliveries (email send attempts + event_key idempotency)

CREATE TABLE notification_deliveries (
  id uuid PRIMARY KEY NOT NULL,
  template_code text NOT NULL,
  to_email text NOT NULL,
  event_key text NOT NULL,
  signup_request_id uuid REFERENCES signup_requests (id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_deliveries_status_check
    CHECK (status IN ('pending', 'success', 'failed'))
);

CREATE UNIQUE INDEX notification_deliveries_event_key_uidx
  ON notification_deliveries (event_key);

CREATE INDEX notification_deliveries_pending_idx
  ON notification_deliveries (status, next_attempt_at)
  WHERE status = 'pending';

CREATE INDEX notification_deliveries_signup_idx
  ON notification_deliveries (signup_request_id);

CREATE INDEX notification_deliveries_created_idx
  ON notification_deliveries (created_at DESC);
