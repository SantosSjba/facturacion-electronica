-- S13-REQ: signup_requests statuses received / under_review (replace pending)

ALTER TABLE signup_requests DROP CONSTRAINT IF EXISTS signup_requests_status_check;

UPDATE signup_requests SET status = 'received' WHERE status = 'pending';

ALTER TABLE signup_requests ALTER COLUMN status SET DEFAULT 'received';

ALTER TABLE signup_requests
  ADD CONSTRAINT signup_requests_status_check
  CHECK (status IN ('received', 'under_review', 'approved', 'rejected'));
