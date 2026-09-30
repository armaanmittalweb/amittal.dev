-- The Switchboard's uptime log (Cloudflare D1). One row per service per check, every 5 minutes.
CREATE TABLE IF NOT EXISTS checks (
  service TEXT NOT NULL,
  at      INTEGER NOT NULL, -- ms since epoch
  ok      INTEGER NOT NULL, -- 1 = up, 0 = down
  ms      INTEGER,          -- round trip, null when it failed
  code    INTEGER           -- HTTP status, null when none came back
);
CREATE INDEX IF NOT EXISTS checks_at ON checks (at);

-- Page views, counted without cookies or ids. One row per site, UTC day and path.
CREATE TABLE IF NOT EXISTS views (
  site TEXT NOT NULL,
  day  TEXT NOT NULL, -- YYYY-MM-DD, UTC
  path TEXT NOT NULL,
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site, day, path)
);

-- Unique visitors per site and day: h is a hash of (daily salt, IP, user agent, site), so it cannot
-- be linked across days once the salt is deleted. Kept 90 days.
CREATE TABLE IF NOT EXISTS visitors (
  site TEXT NOT NULL,
  day  TEXT NOT NULL,
  h    TEXT NOT NULL,
  PRIMARY KEY (site, day, h)
) WITHOUT ROWID;

-- Counts by referrer site, country and device type.
CREATE TABLE IF NOT EXISTS dims (
  site  TEXT NOT NULL,
  day   TEXT NOT NULL,
  kind  TEXT NOT NULL, -- ref | country | device
  value TEXT NOT NULL,
  n     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site, day, kind, value)
);

-- Admin alerts. One row per condition (e.g. down:edusched, meter:neon-edusched); resolved rows are kept 30 days.
CREATE TABLE IF NOT EXISTS alerts (
  key         TEXT PRIMARY KEY,
  level       TEXT NOT NULL, -- warn | critical
  message     TEXT NOT NULL,
  opened_at   INTEGER NOT NULL,
  resolved_at INTEGER
);

-- Small key/value state: the live list, the daily visitor salt, the cached resource snapshot.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
