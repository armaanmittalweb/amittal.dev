-- The Switchboard's uptime log (Cloudflare D1). One row per service per check, every 5 minutes.
CREATE TABLE IF NOT EXISTS checks (
  service TEXT NOT NULL,
  at      INTEGER NOT NULL, -- ms since epoch
  ok      INTEGER NOT NULL, -- 1 = up, 0 = down
  ms      INTEGER,          -- round trip, null when it failed
  code    INTEGER           -- HTTP status, null when none came back
);
CREATE INDEX IF NOT EXISTS checks_at ON checks (at);
