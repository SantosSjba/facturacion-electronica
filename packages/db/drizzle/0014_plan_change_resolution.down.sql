ALTER TABLE plan_change_requests
  DROP CONSTRAINT plan_change_requests_resolution_check,
  DROP COLUMN assigned_org_plan_id,
  DROP COLUMN resolved_by_user_id,
  DROP COLUMN resolved_at,
  DROP COLUMN resolution_note,
  DROP COLUMN resolution;
