-- S16-AUD: speed platform cross-tenant audit list (no org filter)

CREATE INDEX IF NOT EXISTS audit_events_created_idx
  ON audit_events (created_at);
