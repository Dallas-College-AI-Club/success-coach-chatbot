-- Apply once before releasing the shared chat limiter. No student content or
-- raw network addresses are stored. Expired counters are removed on requests.
CREATE TABLE IF NOT EXISTS chat_request_budget (
    bucket text PRIMARY KEY,
    used integer NOT NULL CHECK (used > 0),
    expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_request_budget_expiry ON chat_request_budget (expires_at);
