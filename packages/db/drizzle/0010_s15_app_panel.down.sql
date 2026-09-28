DROP TABLE IF EXISTS notification_preferences;
ALTER TABLE notifications
  DROP COLUMN IF EXISTS read_at,
  DROP COLUMN IF EXISTS body,
  DROP COLUMN IF EXISTS title;
DROP TABLE IF EXISTS plan_change_requests;
