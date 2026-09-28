-- S15-APP: plan change requests, in-app notifications, prefs

CREATE TABLE plan_change_requests (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  current_plan_id uuid REFERENCES plans (id) ON DELETE SET NULL,
  requested_plan_id uuid NOT NULL REFERENCES plans (id) ON DELETE RESTRICT,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_change_requests_status_check CHECK (
    status IN ('pending', 'acknowledged', 'closed')
  )
);

CREATE INDEX plan_change_requests_org_idx ON plan_change_requests (organization_id);
CREATE INDEX plan_change_requests_status_idx ON plan_change_requests (status);

ALTER TABLE notifications
  ADD COLUMN title text,
  ADD COLUMN body text,
  ADD COLUMN read_at timestamptz;

CREATE TABLE notification_preferences (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  event_code text NOT NULL,
  email_enabled boolean NOT NULL DEFAULT true,
  in_app_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX notification_preferences_user_event_uidx
  ON notification_preferences (user_id, event_code);
CREATE INDEX notification_preferences_user_idx ON notification_preferences (user_id);
