-- Rollback S3-AUTH RBAC

ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_actor_type_check;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_actor_type_check CHECK (
  actor_type IN ('api_key', 'system', 'worker', 'support')
);

DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS permissions;
-- citext extension left installed (shared)
