-- Revert S13-REQ status model to pending / approved / rejected

ALTER TABLE signup_requests DROP CONSTRAINT IF EXISTS signup_requests_status_check;

UPDATE signup_requests SET status = 'pending'
WHERE status IN ('received', 'under_review');

ALTER TABLE signup_requests ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE signup_requests
  ADD CONSTRAINT signup_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));
