// backend/utils/staffTargets.js
// `db` can be the pg pool OR a checked-out client.

const THROTTLE_MS = 60_000;
const lastSync = new Map();

/** 'YYYY-MM' or 'YYYY-MM-DD' -> 'YYYY-MM-01'; null if invalid or in the future */
export const normalizeMonth = (input) => {
  if (!input) return null;
  const m = /^(\d{4})-(\d{2})/.exec(String(input));
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  const val = `${m[1]}-${m[2]}-01`;
  const now = new Date();
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  return val > cur ? null : val;
};

/** Create missing target rows (idempotent). Past months get back-filled the same way. */
export const ensureTargets = (db, { month = null, centreId = null, staffId = null, growth = 10 } = {}) =>
  db.query(
    `
    WITH m AS (SELECT COALESCE($1::date, date_trunc('month', CURRENT_DATE)::date) AS month)
    INSERT INTO staff_monthly_targets
      (staff_id, centre_id, month, baseline_amount, growth_percent, target_amount, source)
    SELECT
      s.id, s.centre_id, m.month,
      COALESCE(b.baseline, 0),
      $4::numeric,
      ROUND(COALESCE(b.baseline, 0) * (1 + $4::numeric / 100), 2),
      CASE WHEN m.month < date_trunc('month', CURRENT_DATE)::date THEN 'backfill' ELSE 'live' END
    FROM staff s
    CROSS JOIN m
    LEFT JOIN LATERAL (
      -- average of the (up to) 3 previous months in which the staff actually had work
      SELECT AVG(x.total) AS baseline FROM (
        SELECT SUM(se.service_charges) AS total
        FROM service_entries se
        WHERE se.staff_id = s.id
          AND se.status = 'completed'
          AND se.created_at >= m.month - INTERVAL '3 months'
          AND se.created_at <  m.month
        GROUP BY date_trunc('month', se.created_at)
      ) x
    ) b ON true
    WHERE s.role = 'staff'                                   -- add AND s.is_active if you have such a column
      AND ($2::int  IS NULL OR s.centre_id = $2::int)
      AND ($3::text IS NULL OR s.id::text = $3::text)
      AND NOT EXISTS (
        SELECT 1 FROM staff_monthly_targets x WHERE x.staff_id = s.id AND x.month = m.month
      )
    ON CONFLICT (staff_id, month) DO NOTHING
    `,
    [month, centreId, staffId, growth]
  );

/** Recompute achieved for every 'active' row; rows of past months get closed (frozen) here. */
export const refreshActive = (db, { centreId = null, staffId = null } = {}) =>
  db.query(
    `
    WITH calc AS (
      SELECT t.id, COALESCE(SUM(se.service_charges), 0) AS achieved
      FROM staff_monthly_targets t
      LEFT JOIN service_entries se
        ON se.staff_id = t.staff_id
       AND se.status = 'completed'
       AND se.created_at >= t.month
       AND se.created_at <  t.month + INTERVAL '1 month'
      WHERE t.status = 'active'
        AND ($1::int  IS NULL OR t.centre_id = $1::int)
        AND ($2::text IS NULL OR t.staff_id::text = $2::text)
      GROUP BY t.id
    )
    UPDATE staff_monthly_targets t
    SET achieved_amount     = c.achieved,
        achievement_percent = CASE WHEN t.target_amount > 0
                                   THEN ROUND(c.achieved / t.target_amount * 100, 1) END,
        status    = CASE WHEN t.month < date_trunc('month', CURRENT_DATE)::date THEN 'closed' ELSE 'active' END,
        closed_at = CASE WHEN t.month < date_trunc('month', CURRENT_DATE)::date THEN now() END,
        updated_at = now()
    FROM calc c
    WHERE t.id = c.id
    `,
    [centreId, staffId]
  );

/** ensure + refresh, throttled to once a minute per (centre, month) so page refreshes stay cheap */
export const syncTargets = async (db, { month = null, centreId = null } = {}) => {
  const key = `${centreId ?? "all"}:${month ?? "current"}`;
  const now = Date.now();
  if (now - (lastSync.get(key) || 0) < THROTTLE_MS) return;
  lastSync.set(key, now);
  await ensureTargets(db, { month, centreId });
  await refreshActive(db, { centreId });
};