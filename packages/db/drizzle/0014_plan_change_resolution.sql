ALTER TABLE plan_change_requests
  ADD COLUMN resolution text,
  ADD COLUMN resolution_note text,
  ADD COLUMN resolved_at timestamptz,
  ADD COLUMN resolved_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN assigned_org_plan_id uuid REFERENCES org_plans(id) ON DELETE SET NULL,
  ADD CONSTRAINT plan_change_requests_resolution_check
    CHECK (resolution IS NULL OR (status = 'closed' AND resolution IN ('approved', 'rejected')));

-- Reconcile requests whose requested plan was already assigned after submission.
UPDATE plan_change_requests AS request
SET status = 'closed', resolution = 'approved', resolved_at = assignment.created_at,
    assigned_org_plan_id = assignment.id, updated_at = now()
FROM org_plans AS assignment
WHERE request.status IN ('pending', 'acknowledged')
  AND assignment.organization_id = request.organization_id
  AND assignment.plan_id = request.requested_plan_id
  AND assignment.status IN ('active', 'trialing')
  AND assignment.created_at >= request.created_at
  AND assignment.id = (
    SELECT latest.id FROM org_plans AS latest
    WHERE latest.organization_id = request.organization_id AND latest.status IN ('active', 'trialing')
    ORDER BY latest.created_at DESC, latest.id DESC LIMIT 1
  );
