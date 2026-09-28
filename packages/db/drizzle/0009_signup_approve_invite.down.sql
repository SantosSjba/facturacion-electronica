ALTER TABLE signup_requests DROP COLUMN IF EXISTS organization_id;

DROP INDEX IF EXISTS invite_tokens_user_idx;
DROP INDEX IF EXISTS invite_tokens_token_hash_uidx;
DROP TABLE IF EXISTS invite_tokens;
